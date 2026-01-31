import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI
from collections import defaultdict

# -------------------------------------------------------------------
# Setup
# -------------------------------------------------------------------
app = FastAPI()
load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def normalize_name(name: str) -> str:
    return (name or "").strip().lower()

def _safe_json_list(value):
    """
    Supabase can return JSON arrays as python lists OR as strings.
    This normalizes everything to a python list.
    """
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
    Reuses your exact point logic per set.
    Returns:
      team1_total_points, team2_total_points,
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

    if team1_sets_won > team2_sets_won:
        winner = "team1"
    elif team2_sets_won > team1_sets_won:
        winner = "team2"
    else:
        winner = None

    team1_total = team1_set_points
    team2_total = team2_set_points

    # +3 for match win
    if winner == "team1":
        team1_total += 3
    elif winner == "team2":
        team2_total += 3

    # "clean sweep" bonus from your original code
    # (if team won ALL sets and total games won > 6)
    if sets and team1_sets_won == len(sets):
        total_games_won = sum(s[0] for s in sets if isinstance(s, list) and len(s) == 2)
        if total_games_won > 6:
            team1_total += 3

    if sets and team2_sets_won == len(sets):
        total_games_won = sum(s[1] for s in sets if isinstance(s, list) and len(s) == 2)
        if total_games_won > 6:
            team2_total += 3

    return team1_total, team2_total, team1_sets_won, team2_sets_won, winner

def _split_team_points_to_players(team_points: int, team_norm_in_order):
    """
    Points go to PLAYERS, not team.
    Team points = sum(player points).

    We split team points across 2 players.
    If odd: first player gets +1 (deterministic).
    """
    if len(team_norm_in_order) != 2:
        return {}

    p1, p2 = team_norm_in_order[0], team_norm_in_order[1]
    base = int(team_points) // 2
    remainder = int(team_points) - (base * 2)  # 0 or 1

    return {
        p1: base + remainder,
        p2: base
    }

# -------------------------------------------------------------------
# Main function (KEEP THIS NAME)
# -------------------------------------------------------------------
def update_ratings_for_group(group_id: str):
    # --- Who exists in players table (so we can reset everyone) ---
    players_rows = (
        supabase.table("players")
        .select("name")
        .eq("group_id", group_id)
        .execute()
        .data
        or []
    )

    # --- Fetch matches ordered by newest first ---
    # IMPORTANT: multiple matches can share the same date
    # so we need a tie-breaker (created_at best, else id)
    matches_query = (
        supabase.table("matches")
        .select("*")
        .eq("group_id", group_id)
        .order("match_date", desc=True)
    )

    # Try tie-breaker: created_at (if your table has it)
    # If it doesn't exist in DB, Supabase may error.
    # We handle that by falling back to ordering by id.
    matches_resp = None
    try:
        matches_resp = matches_query.order("created_at", desc=True).execute()
        if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
            raise Exception("created_at ordering failed")
    except Exception:
        matches_resp = matches_query.order("id", desc=True).execute()

    if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
        print("Error fetching matches:", getattr(matches_resp, "data", None))
        return

    matches = matches_resp.data or []

    # --- Aggregators ---
    player_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    player_counted = defaultdict(int)  # player_norm -> counted matches (max 8)

    couple_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    couple_counted = defaultdict(int)  # (p1,p2) -> counted matches (max 8)

    # Debug target
    TRACE_PLAYER = "nikos"
    trace_total_points = 0
    trace_counted_matches = 0

    for match in matches:
        match_id = match.get("id")
        match_date = match.get("match_date")

        team1 = _safe_json_list(match.get("team1"))
        team2 = _safe_json_list(match.get("team2"))
        sets = _safe_json_list(match.get("sets"))

        # Must be real match with sets
        if not team1 or not team2 or not sets:
            continue
        if len(team1) != 2 or len(team2) != 2:
            continue

        team1_norm = [normalize_name(p) for p in team1]
        team2_norm = [normalize_name(p) for p in team2]

        team1_total, team2_total, team1_sets_won, team2_sets_won, winner = _calculate_team_points_from_sets(sets)

        # Split team points into player points
        team1_player_points = _split_team_points_to_players(team1_total, team1_norm)
        team2_player_points = _split_team_points_to_players(team2_total, team2_norm)

        # -------------------------
        # Player stats: last 8 matches PER PLAYER
        # -------------------------
        for pnorm in team1_norm:
            if not pnorm:
                continue

            if player_counted[pnorm] >= 8:
                # Trace why Nikos isn't counted
                if pnorm == TRACE_PLAYER:
                    print(f"[NIKOS TRACE] SKIP match={match_id} date={match_date} (already has 8 counted)")
                continue

            player_counted[pnorm] += 1
            ps = player_stats[pnorm]
            ps["matches"] += 1
            ps["sets"] += team1_sets_won
            ps["points"] += int(team1_player_points.get(pnorm, 0))
            if winner == "team1":
                ps["wins"] += 1

            if pnorm == TRACE_PLAYER:
                trace_counted_matches += 1
                gained = int(team1_player_points.get(pnorm, 0))
                trace_total_points += gained
                print(
                    f"[NIKOS TRACE] COUNT match={match_id} date={match_date} "
                    f"team=team1 winner={winner} "
                    f"team_points={team1_total} player_points={gained} "
                    f"count={trace_counted_matches}/8 total={trace_total_points}"
                )

        for pnorm in team2_norm:
            if not pnorm:
                continue

            if player_counted[pnorm] >= 8:
                if pnorm == TRACE_PLAYER:
                    print(f"[NIKOS TRACE] SKIP match={match_id} date={match_date} (already has 8 counted)")
                continue

            player_counted[pnorm] += 1
            ps = player_stats[pnorm]
            ps["matches"] += 1
            ps["sets"] += team2_sets_won
            ps["points"] += int(team2_player_points.get(pnorm, 0))
            if winner == "team2":
                ps["wins"] += 1

            if pnorm == TRACE_PLAYER:
                trace_counted_matches += 1
                gained = int(team2_player_points.get(pnorm, 0))
                trace_total_points += gained
                print(
                    f"[NIKOS TRACE] COUNT match={match_id} date={match_date} "
                    f"team=team2 winner={winner} "
                    f"team_points={team2_total} player_points={gained} "
                    f"count={trace_counted_matches}/8 total={trace_total_points}"
                )

        # -------------------------
        # Couple stats: last 8 matches PER COUPLE
        # Couples points = TEAM points (not *2)
        # -------------------------
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

    print(f"[NIKOS TRACE] FINAL counted_matches={trace_counted_matches} total_points={trace_total_points}")

    # -------------------------------------------------------------------
    # Update ALL players (reset those without enough matches)
    # IMPORTANT: update by raw player name as stored in players table
    # -------------------------------------------------------------------
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

    # -------------------------------------------------------------------
    # Update couples
    # -------------------------------------------------------------------
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
