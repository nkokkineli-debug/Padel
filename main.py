import os
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI

app = FastAPI()

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
print("SUPABASE_URL:", os.environ.get("SUPABASE_URL"))
print("SUPABASE_KEY:", os.environ.get("SUPABASE_KEY"))
supabase: Client = create_client(url, key)


import json
from collections import defaultdict

def update_ratings_for_group(group_id):
    matches_resp = supabase.table("matches").select("*").eq("group_id", group_id).order("match_date", desc=True).execute()
    if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
        print("Error fetching matches:", getattr(matches_resp, "data", None))
        return

    matches = matches_resp.data
    player_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    couple_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})

    # 1. Build a list of matches for each player and couple, sorted by date descending
    player_matches = defaultdict(list)
    couple_matches = defaultdict(list)

    for match in matches:
        team1 = match["team1"]
        team2 = match["team2"]
        sets = match.get("sets", [])
        match_date = match.get("match_date")

        if isinstance(team1, str):
            try:
                team1 = json.loads(team1)
            except Exception:
                continue
        if isinstance(team2, str):
            try:
                team2 = json.loads(team2)
            except Exception:
                continue
        if isinstance(sets, str):
            try:
                sets = json.loads(sets)
            except Exception:
                sets = []

        # For each player in team1 and team2, add this match to their list
        for player in team1:
            player_matches[player].append((match_date, match))
        for player in team2:

            player_matches[player].append((match_date, match))

        # For each couple, add this match to their list
        if isinstance(team1, list) and len(team1) == 2:
            couple1 = tuple(sorted(team1))
            couple_matches[couple1].append((match_date, match))
        if isinstance(team2, list) and len(team2) == 2:
            couple2 = tuple(sorted(team2))
            couple_matches[couple2].append((match_date, match))

    # 2. For each player, process only their last 5 matches
    for player, matches_list in player_matches.items():
        # Sort by date descending and take the last 5
        matches_list = sorted(matches_list, key=lambda x: x[0], reverse=True)[:5]
        for match_date, match in matches_list:
            team1 = match["team1"]
            team2 = match["team2"]
            sets = match.get("sets", [])
            if isinstance(team1, str):
                try: team1 = json.loads(team1)
                except Exception: continue
            if isinstance(team2, str):
                try: team2 = json.loads(team2)
                except Exception: continue
            if isinstance(sets, str):
                try: sets = json.loads(sets)
                except Exception: sets = []

            team1_sets_won = 0
            team2_sets_won = 0
            team1_set_points = 0
            team2_set_points = 0

            for s in sets:
                games1, games2 = s[0], s[1]
                if games1 > games2:
                    team1_sets_won += 1
                    if games2 == 0:
                        win_points = 6
                        lose_points = 0
                    elif games2 == 1:
                        win_points = 5
                        lose_points = 0
                    elif games2 == 2:
                        win_points = 4

                        lose_points = 1
                    elif games2 == 3:
                        win_points = 3
                        lose_points = 1
                    elif games2 == 4:
                        win_points = 2
                        lose_points = 1
                    elif games2 >= 5:
                        win_points = 1
                        lose_points = 3
                    team1_set_points += win_points + 3
                    team2_set_points += lose_points
                elif games2 > games1:
                    team2_sets_won += 1
                    if games1 == 0:
                        win_points = 6
                        lose_points = 0
                    elif games1 == 1:
                        win_points = 5
                        lose_points = 0
                    elif games1 == 2:
                        win_points = 4
                        lose_points = 1
                    elif games1 == 3:
                        win_points = 3
                        lose_points = 1
                    elif games1 == 4:
                        win_points = 2
                        lose_points = 1
                    elif games1 >= 5:
                        win_points = 1
                        lose_points = 3
                    team2_set_points += win_points + 3
                    team1_set_points += lose_points

            if team1_sets_won > team2_sets_won:
                winner = "team1"
            elif team2_sets_won > team1_sets_won:
                winner = "team2"
            else:
                winner = None

            team1_total_points = sum(player_stats[p]["points"] for p in team1)
            team2_total_points = sum(player_stats[p]["points"] for p in team2)

            def get_match_multiplier(winner, team1_total_points, team2_total_points):
                if winner == "team1":
                    if team2_total_points > team1_total_points:
                        return 1.2
                    elif team2_total_points < team1_total_points:
                        return 0.8
                    else:
                        return 1
                elif winner == "team2":
                    if team1_total_points > team2_total_points:
                        return 1.2
                    elif team1_total_points < team2_total_points:
                        return 0.8
                    else:
                        return 1
                else:

                    return 1

            match_multiplier = get_match_multiplier(winner, team1_total_points, team2_total_points)

            team1_total_awarded = team1_set_points
            team2_total_awarded = team2_set_points

            if winner == "team1":
                team1_total_awarded += 3 * match_multiplier
            elif winner == "team2":
                team2_total_awarded += 3 * match_multiplier

            if team1_sets_won == len(sets) and len(sets) > 0:
                total_games_won = sum(s[0] for s in sets)
                if total_games_won > 6:
                    team1_total_awarded += 3
            if team2_sets_won == len(sets) and len(sets) > 0:
                total_games_won = sum(s[1] for s in sets)
                if total_games_won > 6:
                    team2_total_awarded += 3

            # Update player stats only if this player was in the team
            if player in team1:
                stats = player_stats[player]
                stats["sets"] += team1_sets_won
                stats["matches"] += 1
                if winner == "team1":
                    stats["wins"] += 1
                stats["points"] += team1_total_awarded
            elif player in team2:
                stats = player_stats[player]
                stats["sets"] += team2_sets_won
                stats["matches"] += 1
                if winner == "team2":
                    stats["wins"] += 1
                stats["points"] += team2_total_awarded

    # 3. For each couple, process only their last 5 matches
    for couple, matches_list in couple_matches.items():
        matches_list = sorted(matches_list, key=lambda x: x[0], reverse=True)[:5]
        for match_date, match in matches_list:
            team1 = match["team1"]
            team2 = match["team2"]
            sets = match.get("sets", [])
            if isinstance(team1, str):
                try: team1 = json.loads(team1)
                except Exception: continue
            if isinstance(team2, str):
                try: team2 = json.loads(team2)
                except Exception: continue
            if isinstance(sets,str):
                try: sets = json.loads(sets)
                except Exception: sets = []

            team1_sets_won = 0
            team2_sets_won = 0
            team1_set_points = 0
            team2_set_points = 0

            for s in sets:
                games1, games2 = s[0], s[1]
                if games1 > games2:
                    team1_sets_won += 1
                    if games2 == 0:
                        win_points = 6
                        lose_points = 0
                    elif games2 == 1:
                        win_points = 5
                        lose_points = 0
                    elif games2 == 2:
                        win_points = 4
                        lose_points = 1
                    elif games2 == 3:
                        win_points = 3
                        lose_points = 1
                    elif games2 == 4:
                        win_points = 2
                        lose_points = 1
                    elif games2 >= 5:
                        win_points = 1
                        lose_points = 3
                    team1_set_points += win_points + 3
                    team2_set_points += lose_points
                elif games2 > games1:
                    team2_sets_won += 1
                    if games1 == 0:
                        win_points = 6
                        lose_points = 0
                    elif games1 == 1:
                        win_points = 5
                        lose_points = 0
                    elif games1 == 2:
                        win_points = 4
                        lose_points = 1
                    elif games1 == 3:
                        win_points = 3
                        lose_points = 1
                    elif games1 == 4:
                        win_points = 2
                        lose_points = 1
                    elif games1 >= 5:
                        win_points = 1
                        lose_points = 3
                    team2_set_points += win_points + 3
                    team1_set_points += lose_points

            if team1_sets_won > team2_sets_won:
                winner = "team1"
            elif team2_sets_won > team1_sets_won:
                winner = "team2"
            else:
                winner = None

            match_multiplier = 1  # For couples, you can use the same logic as above if needed

            team1_total_awarded = team1_set_points
            team2_total_awarded = team2_set_points

            if winner == "team1":
                team1_total_awarded += 3 * match_multiplier
            elif winner == "team2":
                team2_total_awarded += 3 * match_multiplier

            if team1_sets_won == len(sets) and len(sets) > 0:
                total_games_won = sum(s[0
] for s in sets)
                if total_games_won > 6:
                    team1_total_awarded += 3
            if team2_sets_won == len(sets) and len(sets) > 0:
                total_games_won = sum(s[1] for s in sets)
                if total_games_won > 6:
                    team2_total_awarded += 3

            # Update couple stats only if this couple was in the team
            if list(couple) == sorted(team1):
                cstats = couple_stats[couple]
                cstats["sets"] += team1_sets_won
                cstats["matches"] += 1
                if winner == "team1":
                    cstats["wins"] += 1
                cstats["points"] += team1_total_awarded * 2
            elif list(couple) == sorted(team2):
                cstats = couple_stats[couple]
                cstats["sets"] += team2_sets_won
                cstats["matches"] += 1
                if winner == "team2":
                    cstats["wins"] += 1
                cstats["points"] += team2_total_awarded * 2

    # Update player ratings in DBs
    for player, stats in player_stats.items():
        try:
            supabase.table("players").update({
                "total_points": int(round(stats["points"])),
                "sets_won": int(round(stats["sets"])),
                "matches_played": int(round(stats["matches"])),
                "matches_won": int(round(stats["wins"]))
            }).eq("name", player).eq("group_id", group_id).execute()
        except Exception as e:
            print(f"Error updating player {player}: {e}")

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