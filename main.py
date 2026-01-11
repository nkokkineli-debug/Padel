import os
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI
import json
from collections import defaultdict

app = FastAPI()
load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def normalize_name(name):
    return (name or "").strip().lower()

def update_ratings_for_group(group_id):
    matches_resp = supabase.table("matches").select("*").eq("group_id", group_id).order("match_date", desc=True).execute()
    if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
        print("Error fetching matches:", getattr(matches_resp, "data", None))
        return

    matches = matches_resp.data
    player_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0, "raw_name": None})
    couple_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})

    # --- Process each match only once ---
    for match in matches:
        team1 = match["team1"]
        team2 = match["team2"]
        sets = match.get("sets", [])
        match_date = match.get("match_date")

        if isinstance(team1, str):
            try: team1 = json.loads(team1)
            except Exception: continue
        if isinstance(team2, str):
            try: team2 = json.loads(team2)
            except Exception: continue
        if isinstance(sets, str):
            try: sets = json.loads(sets)
            except Exception: sets = []

        team1_norm = [normalize_name(p) for p in team1]
        team2_norm = [normalize_name(p) for p in team2]

        team1_sets_won = 0
        team2_sets_won = 0
        team1_set_points = 0
        team2_set_points = 0

        for s in sets:
            games1, games2 = s[0], s[1]
            if games1 > games2:
                team1_sets_won += 1
                if games2 == 0:
                    win_points = 6; lose_points = 0
                elif games2 == 1:
                    win_points = 5; lose_points = 0
                elif games2 == 2:
                    win_points = 4; lose_points = 1
                elif games2 == 3:
                    win_points = 3; lose_points = 1
                elif games2 == 4:
                    win_points = 2; lose_points = 1
                elif games2 >= 5:
                    win_points = 1; lose_points = 3
                team1_set_points += win_points + 3
                team2_set_points += lose_points
            elif games2 > games1:
                team2_sets_won += 1
                if games1 == 0:
                    win_points = 6; lose_points = 0
                elif games1 == 1:
                    win_points = 5; lose_points = 0
                elif games1 == 2:
                    win_points = 4; lose_points = 1
                elif games1 == 3:
                    win_points = 3; lose_points = 1
                elif games1 == 4:
                    win_points = 2; lose_points = 1
                elif games1 >= 5:
                    win_points = 1; lose_points = 3
                team2_set_points += win_points + 3
                team1_set_points += lose_points

        if team1_sets_won > team2_sets_won:
            winner = "team1"
        elif team2_sets_won > team1_sets_won:
            winner = "team2"
        else:
            winner = None

        team1_total_awarded = team1_set_points
        team2_total_awarded = team2_set_points

        if winner == "team1":
            team1_total_awarded += 3
        elif winner == "team2":
            team2_total_awarded += 3

        if team1_sets_won == len(sets) and len(sets) > 0:
            total_games_won = sum(s[0] for s in sets)
            if total_games_won > 6:
                team1_total_awarded += 3
        if team2_sets_won == len(sets) and len(sets) > 0:
            total_games_won = sum(s[1] for s in sets)
            if total_games_won > 6:
                team2_total_awarded += 3

        print(f"\nMatch date: {match_date}")
        print(f"Team1: {team1} (normalized: {team1_norm})")
        print(f"Team2: {team2} (normalized: {team2_norm})")
        print(f"Winner: {winner}")
        print(f"Team1 total awarded: {team1_total_awarded}")
        print(f"Team2 total awarded: {team2_total_awarded}")

        # Assign points to all players in team1
        for i, player in enumerate(team1):
            pname = team1_norm[i]
            stats = player_stats[pname]
            stats["raw_name"] = player
            stats["sets"] += team1_sets_won
            stats["matches"] += 1
            if winner == "team1":
                stats["wins"] += 1
            stats["points"] += team1_total_awarded
            print(f"Assigned {team1_total_awarded} points to player {player} (normalized: {pname}). Total now: {stats['points']}")

        # Assign points to all players in team2
        for i, player in enumerate(team2):
            pname = team2_norm[i]
            stats = player_stats[pname]
            stats["raw_name"] = player
            stats["sets"] += team2_sets_won
            stats["matches"] += 1
            if winner == "team2":
                stats["wins"] += 1
            stats["points"] += team2_total_awarded
            print(f"Assigned {team2_total_awarded} points to player {player} (normalized: {pname}). Total now: {stats['points']}")

        # --- Couple stats ---
        if len(team1_norm) == 2:
            couple1 = tuple(sorted(team1_norm))
            cstats = couple_stats[couple1]
            cstats["sets"] += team1_sets_won
            cstats["matches"] += 1
            if winner == "team1":
                cstats["wins"] += 1
            cstats["points"] += team1_total_awarded * 2
        if len(team2_norm) == 2:
            couple2 = tuple(sorted(team2_norm))
            cstats = couple_stats[couple2]
            cstats["sets"] += team2_sets_won
            cstats["matches"] += 1
            if winner == "team2":
                cstats["wins"] += 1
            cstats["points"] += team2_total_awarded * 2

    # Update player ratings in DBs
    for pname, stats in player_stats.items():
        try:
            print(f"Updating DB for player {stats['raw_name']} (normalized: {pname}) with points: {stats['points']}")
            supabase.table("players").update({
                "total_points": int(round(stats["points"])),
                "sets_won": int(round(stats["sets"])),
                "matches_played": int(round(stats["matches"])),
                "matches_won": int(round(stats["wins"]))
            }).eq("name", stats["raw_name"]).eq("group_id", group_id).execute()
        except Exception as e:
            print(f"Error updating player {stats['raw_name']}: {e}")

    # Update couple ratings in DB
    for couple, stats in couple_stats.items():
        if len(couple) != 2:
            continue
        player1, player2 = couple
        try:
            couple_resp = supabase.table("couples").select("*") \
                .eq("player1", player1).eq("player2", player2).eq("group_id", group_id).execute()
            if not couple_resp.data:
                supabase.table("couples").insert({
                    "player1": player1,
                    "player2": player2,
                    "group_id": group_id,
                    "total_points": int(round(stats["points"])),
                    "sets_won": int(round(stats["sets"])),
                    "matches_played": int(round(stats["matches"])),
                    "matches_won": int(round(stats["wins"]))
                }).execute()
            else:
                supabase.table("couples").update({
                    "total_points": int(round(stats["points"])),
                    "sets_won": int(round(stats["sets"])),
                    "matches_played": int(round(stats["matches"])),
                    "matches_won": int(round(stats["wins"]))
                }).eq("player1", player1).eq("player2", player2).eq("group_id", group_id).execute()
        except Exception as e:
            print(f"Error updating couple {couple}: {e}")