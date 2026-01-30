import os
import json
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client, Client

# -------------------------------------------------
# Supabase init (ONLY ONCE)
# -------------------------------------------------
load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# -------------------------------------------------
# Debug settings
# -------------------------------------------------
DEBUG_ENABLED = True
DEBUG_PLAYER_NAME = "Nikos"   # <-- change to the exact player name you want to track


# -------------------------------------------------
# Helpers
# -------------------------------------------------
def normalize_name(name: str) -> str:
    return (name or "").strip().lower()

def _debug_print(msg: str):
    if DEBUG_ENABLED:
        print(msg)

def _is_debug_player(pnorm: str) -> bool:
    return DEBUG_ENABLED and pnorm == normalize_name(DEBUG_PLAYER_NAME)

def _safe_json_list(value):
    """Return a Python list from list or JSON-string-list. Otherwise []"""
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
    Returns:
      team1_total_points, team2_total_points, team1_sets_won, team2_sets_won, winner("team1"/"team2"/None)

    This keeps your original logic:
      - For each set, winner gets (win_points + 3), loser gets lose_points
      - Win points depend on opponent games in set
      - Match winner gets +3
      - "Straight sets bonus": if a team wins ALL sets and total games won > 6 => +3
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
                win_points, lose_points = 6, 0
            elif games2 == 1:
                win_points, lose_points = 5, 0
            elif games2 == 2:
                win_points, lose_points = 4, 1
            elif games2 == 3:
                win_points, lose_points = 3, 1
            elif games2 == 4:
                win_points, lose_points = 2, 1
            else:  # games2 >= 5
                win_points, lose_points = 1, 3

            team1_set_points += win_points + 3
            team2_set_points += lose_points

        elif games2 > games1:
            team2_sets_won += 1
            if games1 == 0:
                win_points, lose_points = 6, 0
            elif games1 == 1:
                win_points, lose_points = 5, 0
            elif games1 == 2:
                win_points, lose_points = 4, 1
            elif games1 == 3:
                win_points, lose_points = 3, 1
            elif games1 == 4:
                win_points, lose_points = 2, 1
            else:  # games1 >= 5
                win_points, lose_points = 1, 3

            team2_set_points += win_points + 3
            team1_set_points += lose_points

    # winner by sets
    if team1_sets_won > team2_sets_won:
        winner = "team1"
    elif team2_sets_won > team1_sets_won:
        winner = "team2"
    else:
        winner = None

    team1_total = team1_set_points
    team2_total = team2_set_points

    # match winner bonus
    if winner == "team1":
        team1_total += 3
    elif winner == "team2":
        team2_total += 3

    # straight sets bonus: if won ALL sets and total games won > 6
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
    Split team points to the 2 players so that:
      player1 = ceil(team_points/2)
      player2 = floor(team_points/2)
    Team points == sum(player points)
    """
    if len(team_norm_in_order) != 2:
        return {}
    p1, p2 = team_norm_in_order[0], team_norm_in_order[1]
    base = int(team_points) // 2
    remainder = int(team_points) - (base * 2)  # 0 or 1
    return {p1: base + remainder, p2: base}


# -------------------------------------------------
# Main function used by API
# -------------------------------------------------
def update_ratings_for_group(group_id: str):
    """
    Recalculate ratings for a group using ONLY:
      - last 8 matches per player (by match_date desc)
      - last 8 matches per couple (by match_date desc)

    IMPORTANT:
      - A match can count for one player but not the partner if partner already reached 8 newer matches.
      - Team points are split into player points. Team points = p1 + p2.
    """

    # Get all players in group so we can reset players that have <8 matches too
    players_rows = supabase.table("players").select("name").eq("group_id", group_id).execute().data or []

    # Get all matches ordered by newest first (by match_date)
    matches_resp = supabase.table("matches") \
        .select("*") \
        .eq("group_id", group_id) \
        .order("match_date", desc=True) \
        .execute()

    if hasattr(matches_resp, "status_code") and matches_resp.status_code >= 400:
        print("Error fetching matches:", getattr(matches_resp, "data", None))
        return

    matches = matches_resp.data or []

    player_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    player_counted = defaultdict(int)  # player_norm -> matches counted (max 8)

    couple_stats = defaultdict(lambda: {"points": 0, "sets": 0, "matches": 0, "wins": 0})
    couple_counted = defaultdict(int)  # (p1,p2) -> matches counted (max 8)

    nikos_norm = normalize_name(DEBUG_PLAYER_NAME)

    for match in matches:
        match_date = match.get("match_date")
        match_id = match.get("id")

        team1 = _safe_json_list(match.get("team1"))
        team2 = _safe_json_list(match.get("team2"))
        sets = _safe_json_list(match.get("sets"))

        # must have complete info
        if not team1 or not team2 or not sets:
            continue
        if len(team1) != 2 or len(team2) != 2:
            continue

        team1_norm = [normalize_name(p) for p in team1]
        team2_norm = [normalize_name(p) for p in team2]

        team1_total, team2_total, team1_sets_won, team2_sets_won, winner = _calculate_team_points_from_sets(sets)

        # Split to players (team points == sum players)
        team1_player_points = _split_team_points_to_players(team1_total, team1_norm)
        team2_player_points = _split_team_points_to_players(team2_total, team2_norm)

        # DEBUG: print match if Nikos participates
        if DEBUG_ENABLED and (nikos_norm in team1_norm or nikos_norm in team2_norm):
            _debug_print("\n==================== DEBUG MATCH (TRACKED PLAYER) ====================")
            _debug_print(f"Tracked player: {DEBUG_PLAYER_NAME} ({nikos_norm})")
            _debug_print(f"Date: {match_date} | Match ID: {match_id}")
            _debug_print(f"Team1 raw: {team1} | norm: {team1_norm}")
            _debug_print(f"Team2 raw: {team2} | norm: {team2_norm}")
            _debug_print(f"Sets: {sets}")
            _debug_print(f"Sets won: team1={team1_sets_won}, team2={team2_sets_won}, winner={winner}")
            _debug_print(f"Team totals: team1_total={team1_total}, team2_total={team2_total}")
            _debug_print(f"Split team1 -> {team1_player_points}")
            _debug_print(f"Split team2 -> {team2_player_points}")

        # -----------------------------
        # PER PLAYER: only last 8 matches per player
        # -----------------------------
        for pnorm in team1_norm:
            if not pnorm:
                continue

            before = player_counted[pnorm]
            if before >= 8:
                if _is_debug_player(pnorm):
                    _debug_print(f"[{DEBUG_PLAYER_NAME}] SKIP (already has 8 counted). Date={match_date} id={match_id}")
                continue

            player_counted[pnorm] += 1
            ps = player_stats[pnorm]
            before_points = ps["points"]

            gained = int(team1_player_points.get(pnorm, 0))
            ps["matches"] += 1
            ps["sets"] += team1_sets_won
            ps["points"] += gained
            if winner == "team1":
                ps["wins"] += 1

            if _is_debug_player(pnorm):
                _debug_print(
                    f"[{DEBUG_PLAYER_NAME}] COUNTED #{before+1}/8 as TEAM1 | gained={gained} | "
                    f"points {before_points}->{ps['points']} | sets+={team1_sets_won} | "
                    f"win={'yes' if winner=='team1' else 'no'} | {match_date} id={match_id}"
                )

        for pnorm in team2_norm:
            if not pnorm:
                continue

            before = player_counted[pnorm]
            if before >= 8:
                if _is_debug_player(pnorm):
                    _debug_print(f"[{DEBUG_PLAYER_NAME}] SKIP (already has 8 counted). Date={match_date} id={match_id}")
                continue

            player_counted[pnorm] += 1
            ps = player_stats[pnorm]
            before_points = ps["points"]

            gained = int(team2_player_points.get(pnorm, 0))
            ps["matches"] += 1
            ps["sets"] += team2_sets_won
            ps["points"] += gained
            if winner == "team2":
                ps["wins"] += 1

            if _is_debug_player(pnorm):
                _debug_print(
                    f"[{DEBUG_PLAYER_NAME}] COUNTED #{before+1}/8 as TEAM2 | gained={gained} | "
                    f"points {before_points}->{ps['points']} | sets+={team2_sets_won} | "
                    f"win={'yes' if winner=='team2' else 'no'} | {match_date} id={match_id}"
                )

        # -----------------------------
        # PER COUPLE: only last 8 matches per couple
        # Couple points = TEAM points (not *2)
        # -----------------------------
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

    # Final debug summary
    if DEBUG_ENABLED:
        ps = player_stats.get(nikos_norm, {"points": 0, "sets": 0, "matches": 0, "wins": 0})
        _debug_print("\n==================== DEBUG SUMMARY (TRACKED PLAYER) ====================")
        _debug_print(f"Tracked player: {DEBUG_PLAYER_NAME} ({nikos_norm})")
        _debug_print(f"Counted matches: {player_counted.get(nikos_norm, 0)}")
        _debug_print(f"Totals: points={ps['points']} matches={ps['matches']} wins={ps['wins']} sets_won={ps['sets']}")
        _debug_print("=======================================================================\n")

    # -------------------------------------------------
    # Update ALL players in DB (reset those without matches too)
    # IMPORTANT: uses raw_name from players table to match rows
    # -------------------------------------------------
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

    # -------------------------------------------------
    # Update couples table (only couples that exist in last 8 counted)
    # -------------------------------------------------
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