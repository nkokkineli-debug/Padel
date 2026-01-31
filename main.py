import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI
from collections import defaultdict

# ------------------------------------------------------------
# Setup
# ------------------------------------------------------------
app = FastAPI()
load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def normalize_name(name: str) -> str:
    return (name or "").strip().lower()

def _safe_json_list(value):
    """Supabase can return JSON arrays as python lists OR as strings."""
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
    """
    Your original scoring logic, unchanged.
    Returns:
      team1_total_awarded, team2_total_awarded,
      team1_sets_won, team2_sets_won,
      winner ("team1" | "team2" | None)
    """
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
            else:
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
            else:
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

    # +3 match win bonus
    if winner == "team1":
        team1_total_awarded += 3
    elif winner == "team2":
        team2_total_awarded += 3

    # clean sweep bonus from your original code
    if team1_sets_won == len(sets) and len(sets) > 0:
        total_games_won = sum(s[0] for s in sets if isinstance(s, list) and len(s) == 2)
        if total_games_won > 6:
            team1_total_awarded += 3

    if team2_sets_won == len(sets) and len(sets) > 0:
        total_games_won = sum(s[1] for s in sets if isinstance(s, list) and len(s) == 2)
        if total_games_won > 6:
            team2_total_awarded += 3

    return team1_total_awarded, team2_total_awarded, team1_sets_won, team2_sets_won, winner

def _split_team_points_to_players(team_points: int, team_norm_in_order):
    """
    Player points are derived from TEAM points.
    Team points = sum(player points).
    Split equally; if odd, first player gets +1 (deterministic).
    """
    if len(team_norm_in_order) != 2:
        return {}
    p1, p2 = team_norm_in_order[0], team_norm_in_order[1]
    base = int(team_points) // 2
    remainder = int(team_points) - (base * 2)  # 0 or 1
    return {p1: base + remainder, p2: base}

# ------------------------------------------------------------
# Main function (KEEP NAME)
# ------------------------------------------------------------
def update_ratings_for_group(group_id: str):
    # --------
    # Load players (so we can reset everyone)
    # --------
    players_rows = (
        supabase.table("players")
        .select("name")
        .eq("group_id", group_id)
        .execute()
        .data
        or []
    )

    # --------
    # Load matches newest first.
    # Multiple matches per date => tie-break by created_at if possible, else id.
    # --------
    base_q = (
        supabase.table("matches")
        .select("*")
        .eq("group_id", group_id)
        .order("match_date", desc=True)
    )

    try:
        matches_resp = base_q.order("created_at", desc=True).execute()
        if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
            raise Exception("created_at ordering failed")
    except Exception:
        matches_resp = base_q.order("id", desc=True).execute()

    if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
        print("Error fetching matches:", getattr(matches_resp, "data", None))
        return

    matches = matches_resp.data or []

    # --------
    # Build per-player match history (newest -> oldest)
    # Each player keeps their own last 8 match rows
    # --------
    per_player_history = defaultdict(list)  # pnorm -> list of dict rows (newest first)
    couple_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})

    TRACE_PLAYER = "nikos"  # normalized (lowercase); change if needed

    for match in matches:
        match_id = match.get("id")
        match_date = match.get("match_date")

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

        # ---- PLAYER POINTS (per player, split team points) ----
        team1_player_points = _split_team_points_to_players(team1_total, team1_norm)
        team2_player_points = _split_team_points_to_players(team2_total, team2_norm)

        # push match into each player's personal history
        for pnorm in team1_norm:
            if not pnorm:
                continue
            per_player_history[pnorm].append({
                "match_id": match_id,
                "match_date": match_date,
                "team": "team1",
                "winner": winner,
                "team_points": team1_total,
                "player_points": int(team1_player_points.get(pnorm, 0)),
                "sets_won": int(team1_sets_won),
                "won_match": 1 if winner == "team1" else 0,
            })

        for pnorm in team2_norm:
            if not pnorm:
                continue
            per_player_history[pnorm].append({
                "match_id": match_id,
                "match_date": match_date,
                "team": "team2",
                "winner": winner,
                "team_points": team2_total,
                "player_points": int(team2_player_points.get(pnorm, 0)),
                "sets_won": int(team2_sets_won),
                "won_match": 1 if winner == "team2" else 0,
            })

        # ---- COUPLE POINTS (KEEP YOUR OLD LOGIC) ----
        # couple points += team_total_awarded * 2
        if len(team1_norm) == 2:
            couple1 = tuple(sorted(team1_norm))
            cstats = couple_stats[couple1]
            cstats["sets"] += team1_sets_won
            cstats["matches"] += 1
            if winner == "team1":
                cstats["wins"] += 1
            cstats["points"] += int(team1_total) * 2

        if len(team2_norm) == 2:
            couple2 = tuple(sorted(team2_norm))
            cstats = couple_stats[couple2]
            cstats["sets"] += team2_sets_won
            cstats["matches"] += 1
            if winner == "team2":
                cstats["wins"] += 1
            cstats["points"] += int(team2_total) * 2

    # --------
    # Aggregate per-player stats from EACH player's own last 8 matches
    # --------
    player_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})

    for pnorm, history in per_player_history.items():
        last8 = history[:8]  # history is already newest -> oldest because matches were iterated newest first
        ps = player_stats[pnorm]
        ps["matches"] = len(last8)
        ps["points"] = sum(x["player_points"] for x in last8)
        ps["sets"] = sum(x["sets_won"] for x in last8)
        ps["wins"] = sum(x["won_match"] for x in last8)

        if pnorm == TRACE_PLAYER:
            print(f"\n[NIKOS TRACE] Using last {len(last8)} matches for Nikos:")
            running = 0
            for i, x in enumerate(last8, start=1):
                running += x["player_points"]
                print(
                    f"[NIKOS TRACE] {i}/8 match_id={x['match_id']} date={x['match_date']} "
                    f"team={x['team']} winner={x['winner']} "
                    f"team_points={x['team_points']} player_points={x['player_points']} running_total={running}"
                )
            print(f"[NIKOS TRACE] FINAL last8_points={ps['points']} last8_matches={ps['matches']} wins={ps['wins']} sets_won={ps['sets']}\n")

    # --------
    # Update ALL players (reset those with no recent matches to 0)
    # IMPORTANT: update by raw player name stored in players table
    # --------
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

    # --------
    # Update couples table (KEEP OLD LOGIC)
    # --------
    for (p1, p2), cs in couple_stats.items():
        if not p1 or not p2:
            continue

        existing = (
            supabase.table("couples")
            .select("*")
            .eq("player1", p1)
            .eq("player2", p2)
            .eq("group_id", group_id)
            .execute()
            .data
        )

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
