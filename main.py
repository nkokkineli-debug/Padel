import os
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI
import json
from collections import defaultdict

def normalize_name(name: str) -> str:
    return (name or "").strip().lower()

def _safe_json_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            v = json.loads(value)
            return v if isinstance(v, list) else []
        except Exception:
            return []
    return []

def _calculate_team_points_from_sets(sets):
    team1_sets_won = 0
    team2_sets_won = 0
    team1_set_points = 0
    team2_set_points = 0

    for s in sets:
        if not (isinstance(s, list) and len(s) == 2):
            continue
        games1, games2 = s[0], s[1]

        if games1 > games2:
            team1_sets_won += 1
            if games2 == 0: win_points, lose_points = 6, 0
            elif games2 == 1: win_points, lose_points = 5, 0
            elif games2 == 2: win_points, lose_points = 4, 1
            elif games2 == 3: win_points, lose_points = 3, 1
            elif games2 == 4: win_points, lose_points = 2, 1
            else: win_points, lose_points = 1, 3
            team1_set_points += win_points + 3
            team2_set_points += lose_points

        elif games2 > games1:
            team2_sets_won += 1
            if games1 == 0: win_points, lose_points = 6, 0
            elif games1 == 1: win_points, lose_points = 5, 0
            elif games1 == 2: win_points, lose_points = 4, 1
            elif games1 == 3: win_points, lose_points = 3, 1
            elif games1 == 4: win_points, lose_points = 2, 1
            else: win_points, lose_points = 1, 3
            team2_set_points += win_points + 3
            team1_set_points += lose_points

    if team1_sets_won > team2_sets_won: winner = "team1"
    elif team2_sets_won > team1_sets_won: winner = "team2"
    else: winner = None

    team1_total = team1_set_points
    team2_total = team2_set_points

    if winner == "team1": team1_total += 3
    elif winner == "team2": team2_total += 3

    if sets and team1_sets_won == len(sets):
        if sum(s[0] for s in sets if isinstance(s, list) and len(s) == 2) > 6:
            team1_total += 3
    if sets and team2_sets_won == len(sets):
        if sum(s[1] for s in sets if isinstance(s, list) and len(s) == 2) > 6:
            team2_total += 3

    return team1_total, team2_total, team1_sets_won, team2_sets_won, winner

def _split_team_points_to_players(team_points: int, team_norm_in_order):
    if len(team_norm_in_order) != 2:
        return {}
    p1, p2 = team_norm_in_order[0], team_norm_in_order[1]
    base = int(team_points) // 2
    remainder = int(team_points) - (base * 2)  # 0 or 1
    return {p1: base + remainder, p2: base}

def update_ratings_for_group(group_id: str):
    players_rows = supabase.table("players").select("name").eq("group_id", group_id).execute().data or []

    matches_resp = supabase.table("matches").select("*").eq("group_id", group_id).order("match_date", desc=True).execute()
    if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
        print("Error fetching matches:", getattr(matches_resp, "data", None))
        return

    matches = matches_resp.data or []

    player_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    player_counted = defaultdict(int)  # player_norm -> matches counted (max 8)

    couple_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    couple_counted = defaultdict(int)  # (p1,p2) -> matches counted (max 8)

    for match in matches:
        team1 = _safe_json_list(match.get("team1"))
        team2 = _safe_json_list(match.get("team2"))
        sets = _safe_json_list(match.get("sets"))

        if not team1 or not team2 or not sets:
            continue
        if len(team1) != 2 or len(team2) != 2:
            continue

        team1_norm = [normalize_name(p) for p in team1]
        team2_norm = [normalize_name(p) for p in team2]

        team1_total, team2_total, team1_sets_won, team2_sets_won, winner = _calculate_team_points_from_sets(sets)

        team1_player_points = _split_team_points_to_players(team1_total, team1_norm)
        team2_player_points = _split_team_points_to_players(team2_total, team2_norm)

        # Per-player: only last 8 matches
        for pnorm in team1_norm:
            if not pnorm or player_counted[pnorm] >= 8:
                continue
            player_counted[pnorm] += 1
            ps = player_stats[pnorm]
            ps["matches"] += 1
            ps["sets"] += team1_sets_won
            ps["points"] += int(team1_player_points.get(pnorm, 0))
            if winner == "team1":
                ps["wins"] += 1

        for pnorm in team2_norm:
            if not pnorm or player_counted[pnorm] >= 8:
                continue
            player_counted[pnorm] += 1
            ps = player_stats[pnorm]
            ps["matches"] += 1
            ps["sets"] += team2_sets_won
            ps["points"] += int(team2_player_points.get(pnorm, 0))
            if winner == "team2":
                ps["wins"] += 1

        # Couples: points = TEAM points (not *2), last 8 matches per couple
        couple1 = tuple(sorted(team1_norm))
        if len(couple1) == 2 and couple_counted[couple1] < 8:
            couple_counted[couple1] += 1
            cs = couple_stats[couple1]
            cs["matches"] += 1
            cs["sets"] += team1_sets_won
            cs["points"] += int(team1_total)
            if winner == "team1":
                cs["wins"] += 1

        couple2 = tuple(sorted(team2_norm))
        if len(couple2) == 2 and couple_counted[couple2] < 8:
            couple_counted[couple2] += 1
            cs = couple_stats[couple2]
            cs["matches"] += 1
            cs["sets"] += team2_sets_won
            cs["points"] += int(team2_total)
            if winner == "team2":
                cs["wins"] += 1

    # Update ALL players (reset inactive to 0 so results are consistent)
    for pr in players_rows:
        raw_name = pr.get("name")
        pnorm = normalize_name(raw_name)
        ps = player_stats.get(pnorm, {"points": 0, "sets": 0, "matches": 0, "wins": 0})

        supabase.table("players").update({
            "total_points": int(ps["points"]),
            "sets_won": int(ps["sets"]),
            "matches_played": int(ps["matches"]),
            "matches_won": int(ps["wins"]),
        }).eq("name", raw_name).eq("group_id", group_id).execute()

    # Update couples table
    for (p1, p2), cs in couple_stats.items():
        if not p1 or not p2:
            continue

        existing = supabase.table("couples").select("*") \
            .eq("player1", p1).eq("player2", p2).eq("group_id", group_id).execute().data

        payload = {
            "player1": p1,
            "player2": p2,
            "group_id": group_id,
            "total_points": int(cs["points"]),
            "sets_won": int(cs["sets"]),
            "matches_played": int(cs["matches"]),
            "matches_won": int(cs["wins"]),
        }

        if not existing:
            supabase.table("couples").insert(payload).execute()
        else:
            supabase.table("couples").update(payload) \
                .eq("player1", p1).eq("player2", p2).eq("group_id", group_id).execute()

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