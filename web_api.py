from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
from itertools import combinations
from fastapi.responses import JSONResponse
from main import update_ratings_for_group
import uuid
import main  # <-- Import your business logic and supabase client

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    ##allow_origins=["https://padel-chi.vercel.appss"],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = main.supabase  # Use the same Supabase client as in main.py

# --- Group Management ---
@app.post("/create_group")
async def create_group(request: Request):
    data = await request.json()
    group_name = data.get("group_name")
    username = data.get("username")
    group_id = str(uuid.uuid4())

    try:
        user_res = supabase.table("users").select("nickname").eq("username", username).execute()
        if hasattr(user_res, "status_code") and user_res.status_code >= 400:
            return {"error": getattr(user_res, "data", None)}
        nickname = user_res.data[0]["nickname"] if user_res.data and user_res.data[0].get("nickname") else username

        supabase.table("groups").insert({"id": group_id, "name": group_name}).execute()
        supabase.table("user_groups").insert({"username": username, "group_id": group_id}).execute()
        supabase.table("players").insert({
            "name": nickname,
            "group_id": group_id,
            "total_points": 0,
            "sets_won": 0,
            "matches_played": 0,
            "matches_won": 0
        }).execute()
        return {"message": f"Group '{group_name}' created successfully!", "id": group_id}
    except Exception as e:
        print("Error in /create_group:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/view_groups")
def view_groups(username: str):
    try:
        memberships = supabase.table("user_groups").select("*").eq("username", username).execute().data
        group_ids = [m["group_id"] for m in memberships]
        groups = []
        for gid in group_ids:
            group = supabase.table("groups").select("*").eq("id", gid).execute().data
            if group:
                groups.append(group[0])
        return {"groups": groups}
    except Exception as e:
        print("Error in /view_groups:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/delete_group")
async def delete_group(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    try:
        supabase.table("user_groups").delete().eq("group_id", group_id).execute()
        supabase.table("matches").delete().eq("group_id", group_id).execute()
        supabase.table("next_matches").delete().eq("group_id", group_id).execute()
        supabase.table("players").delete().eq("group_id", group_id).execute()
        supabase.table("groups").delete().eq("id", group_id).execute()
        return {"message": f"Group '{group_id}' deleted."}
    except Exception as e:
        print("Error in /delete_group:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Player Management ---
@app.post("/add_player_to_group")
async def add_player_to_group(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    nickname = data.get("nickname")
    try:
        existing = supabase.table("players") \
            .select("*") \
            .eq("name", nickname) \
            .eq("group_id", group_id) \
            .execute().data
        if existing:
            return {"message": f"Player '{nickname}' already exists in this group.", "name": nickname}
        supabase.table("players").insert({
            "name": nickname,
            "group_id": group_id,
            "total_points": 0,
            "sets_won": 0,
            "matches_played": 0,
            "matches_won": 0
        }).execute()
        return {"message": f"Player '{nickname}' added to group!", "name": nickname, "nickname": nickname}
    except Exception as e:
        print("Error in /add_player_to_group:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/players")
def get_players(group_id: Optional[str] = Query(None)):
    try:
        query = supabase.table("players").select("*")
        if group_id:
            query = query.eq("group_id", group_id)
        players = query.execute().data
        return players
    except Exception as e:
        print("Error in /players:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/remove_player_from_group")
async def remove_player_from_group(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    name = data.get("name")
    try:
        supabase.table("players").delete().eq("name", name).eq("group_id", group_id).execute()
        return {"message": f"Player '{name}' removed from group."}
    except Exception as e:
        print("Error in /remove_player_from_group:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Next Match Management ---
@app.post("/create_next_match")
async def create_next_match(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    match_date = data.get("match_date")
    try:
        supabase.table("next_matches").insert({
            "group_id": group_id,
            "match_date": match_date,
            "registered_users": []
        }).execute()
        return {"message": "Next match created!"}
    except Exception as e:
        print("Error in /create_next_match:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/next_matches")
def get_next_matches(group_id: str):
    try:
        matches = supabase.table("next_matches").select("*").eq("group_id", group_id).execute().data
        return {"matches": matches}
    except Exception as e:
        print("Error in /next_matches:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/add_player_to_next_match")
async def add_player_to_next_match(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    match_date = data.get("match_date")
    username = data.get("username")
    try:
        match = supabase.table("next_matches").select("*").eq("group_id", group_id).eq("match_date", match_date).execute().data
        if not match:
            return {"error": "Match not found."}
        reg_users = match[0]["registered_users"] or []
        if username not in reg_users:
            reg_users.append(username)
            supabase.table("next_matches").update({"registered_users": reg_users}).eq("id", match[0]["id"]).execute()
        return {"message": f"Player '{username}' added to next match."}
    except Exception as e:
        print("Error in /add_player_to_next_match:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/remove_player_from_next_match")
async def remove_player_from_next_match(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    match_date = data.get("match_date")
    username = data.get("username")
    try:
        match = supabase.table("next_matches").select("*").eq("group_id", group_id).eq("match_date", match_date).execute().data
        if match:
            reg_users = match[0]["registered_users"] or []
            if username in reg_users:
                reg_users.remove(username)
                supabase.table("next_matches").update({"registered_users": reg_users}).eq("id", match[0]["id"]).execute()
        return {"message": f"Removed {username} from next match."}
    except Exception as e:
        print("Error in /remove_player_from_next_match:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/delete_next_match")
async def delete_next_match(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    match_id = data.get("match_id")
    try:
        supabase.table("next_matches").delete().eq("id", match_id).eq("group_id", group_id).execute()
        return {"message": f"Match '{match_id}' deleted."}
    except Exception as e:
        print("Error in /delete_next_match:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Results & Ratings ---
@app.post("/register_match_result")
async def register_match_result(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    match_id = data.get("match_id")  # Optional for ad-hoc
    match_date = data.get("match_date")
    mode = data.get("mode")
    couples = data.get("couples")
    results = data.get("results")
    if not (group_id and couples and results):
        return {"error": "Missing required fields."}
    try:
        # Prepare couples as list of player id pairs, ordered for uniqueness
        couples_ids = []
        for couple in couples:
            sorted_couple = sorted(couple)
            if len(sorted_couple) != 2:
                return {"error": f"Each couple must have exactly 2 player IDs: {couple}"}
            couples_ids.append(sorted_couple)

        # --- Fetch all matches for this group and day ---
        existing_matches = supabase.table("matches") \
            .select("team1,team2,next_match_id") \
            .eq("group_id", group_id) \
            .eq("match_date", match_date) \
            .execute().data

        # --- Duplicate couple combination check for the same day ---
        for res in results:
            team1_ids = sorted(res["team1"])
            team2_ids = sorted(res["team2"])
            if len(team1_ids) != 2 or len(team2_ids) != 2:
                return {"error": "Each team must have exactly 2 player IDs."}

            for match in existing_matches:
                # Parse team1/team2 if stored as string
                import json
                m_team1 = match.get("team1", [])
                m_team2 = match.get("team2", [])
                if isinstance(m_team1, str):
                    try: m_team1 = json.loads(m_team1)
                    except Exception: m_team1 = []
                if isinstance(m_team2, str):
                    try: m_team2 = json.loads(m_team2)
                    except Exception: m_team2 = []

                # Check for duplicate (order-insensitive)
                if ((sorted(m_team1) == team1_ids and sorted(m_team2) == team2_ids) or
                    (sorted(m_team1) == team2_ids and sorted(m_team2) == team1_ids)):
                    # If updating itself, allow
                    if match_id and str(match.get("next_match_id")) == str(match_id):
                        continue
                    return {"error": "This couple combination already exists for this day."}

        # --- Insert results ---
        for res in results:
            team1_ids = sorted(res["team1"])
            team2_ids = sorted(res["team2"])
            insert_data = {
                "group_id": group_id,
                "match_date": match_date,
                "team1": team1_ids,
                "team2": team2_ids,
                "sets": res.get("sets", []),
                "mode": mode,
                "couples": couples_ids,
            }
            if match_id:
                insert_data["next_match_id"] = match_id
            resp = supabase.table("matches").insert(insert_data).execute()
            if hasattr(resp, "status_code") and resp.status_code >= 400:
                return {"error": getattr(resp, "data", None)}

        if match_id:
            supabase.table("next_matches").delete().eq("id", match_id).execute()

        # --- Call your main.py logic here ---
        main.update_ratings_for_group(group_id)
        return {"message": "Results registered!"}
    except Exception as e:
        print("Error in /register_match_result:", e)
        return JSONResponse({"error": str(e)}, status_code=500)
    
@app.post("/update_match_result")
async def update_match_result(request: Request):
    data = await request.json()
    match_id = data.get("match_id")
    group_id = data.get("group_id")
    couples = data.get("couples")
    results = data.get("results")
    try:
        matches = supabase.table("matches").select("*").eq("next_match_id", match_id).execute().data

        for idx, match in enumerate(matches):
            team1_ids = sorted(results[idx]["team1"])
            team2_ids = sorted(results[idx]["team2"])
            sets = results[idx].get("sets", [])
            score1 = sum(1 for s in sets if s[0] > s[1])
            score2 = sum(1 for s in sets if s[1] > s[0])

            update_data = {
                "team1": team1_ids,
                "team2": team2_ids,
                "sets": sets,
                "score1": score1,
                "score2": score2,
                "couples": couples
            }
            resp = supabase.table("matches").update(update_data).eq("id", match["id"]).execute()
            if hasattr(resp, "status_code") and resp.status_code >= 400:
                return {"error": getattr(resp, "data", None)}

        # --- Call your main.py logic here ---
        main.update_ratings_for_group(group_id)
        return {"message": "Result updated!"}
    except Exception as e:
        print("Error in /update_match_result:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/matches")
def get_matches(group_id: Optional[str] = Query(None)):
    try:
        query = supabase.table("matches").select("*")
        if group_id:
            query = query.eq("group_id", group_id)
        matches = query.execute().data
        return {"matches": matches}
    except Exception as e:
        print("Error in /matches:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Ratings Endpoints ---
@app.get("/player_ratings")
def player_ratings(group_id: str):
    try:
        players = supabase.table("players").select("*").eq("group_id", group_id).execute().data
        return {"players": players}
    except Exception as e:
        print("Error in /player_ratings:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/couple_ratings")
def couple_ratings(group_id: str):
    try:
        couples = supabase.table("couples").select("*").eq("group_id", group_id).execute().data
        players = supabase.table("players").select("id, name").eq("group_id", group_id).execute().data
        id_to_name = {p["id"]: p["name"] for p in players}
        for c in couples:
            c["player1_name"] = id_to_name.get(c["player1"], c["player1"])
            c["player2_name"] = id_to_name.get(c["player2"], c["player2"])
        return {"couples": couples}
    except Exception as e:
        print("Error in /couple_ratings:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/set_nickname")
async def set_nickname(request: Request):
    data = await request.json()
    username = data.get("username")  # This should be the user's email
    new_nickname = data.get("nickname")
    try:
        # 1. Get old nickname
        user_row = supabase.table("users").select("nickname").eq("username", username).execute().data
        old_nickname = user_row[0]["nickname"] if user_row and user_row[0].get("nickname") else username

        # 2. Update nickname in users table
        supabase.table("users").update({"nickname": new_nickname}).eq("username", username).execute()

        # 3. For each group the user is in, update player and matches
        user_groups = supabase.table("user_groups").select("group_id").eq("username", username).execute().data
        for group in user_groups:
            group_id = group["group_id"]
            # Update player's name
            supabase.table("players").update({"name": new_nickname}).eq("group_id", group_id).eq("name", old_nickname).execute()
            # Update matches
            matches = supabase.table("matches").select("*").eq("group_id", group_id).execute().data
            for match in matches:
                import json
                team1 = match.get("team1", [])
                team2 = match.get("team2", [])
                couples = match.get("couples", [])
                if isinstance(team1, str):
                    try: team1 = json.loads(team1)
                    except Exception: team1 = []
                if isinstance(team2, str):
                    try: team2 = json.loads(team2)
                    except Exception: team2 = []
                if isinstance(couples, str):
                    try: couples = json.loads(couples)
                    except Exception: couples = []
                new_team1 = [new_nickname if p == old_nickname else p for p in team1]
                new_team2 = [new_nickname if p == old_nickname else p for p in team2]
                new_couples = [[new_nickname if p == old_nickname else p for p in couple] for couple in couples]
                if team1 != new_team1 or team2 != new_team2 or couples != new_couples:
                    supabase.table("matches").update({
                        "team1": json.dumps(new_team1),
                        "team2": json.dumps(new_team2),
                        "couples": json.dumps(new_couples)
                    }).eq("id", match["id"]).execute()

        return {"message": "Nickname updated everywhere!"}
    except Exception as e:
        print("Error in /set_nickname:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Propose Teams Endpoint ---
@app.get("/propose_teams")
def propose_teams(group_id: str, match_date: str):
    import json

    try:
        # 1. Get registered users for the match
        match = supabase.table("next_matches").select("*").eq("group_id", group_id).eq("match_date", match_date).execute().data
        if not match:
            return {"couples": [], "leftover": None}
        users = match[0].get("registered_users", [])
        if not users or len(users) < 2:
            return {"couples": [], "leftover": users[0] if users else None}

        # 2. Get player points
        players_data = supabase.table("players").select("name,total_points").eq("group_id", group_id).execute().data
        player_points = {p["name"]: p.get("total_points", 0) for p in players_data}

        # 3. Get couple points
        couples_data = supabase.table("couples").select("player1,player2,total_points").eq("group_id", group_id).execute().data
        couple_points = {}
        for c in couples_data:
            key1 = (c["player1"], c["player2"])
            key2 = (c["player2"], c["player1"])
            couple_points[key1] = c.get("total_points", 0)
            couple_points[key2] = c.get("total_points", 0)

        # 4. Generate all possible couples
        all_couples = list(combinations(users, 2))

        # 5. Find best set of non-overlapping couples
        n = len(users)
        max_couples = n // 2
        best_combo = None
        min_diff = float('inf')
        best_strengths = None

        def is_non_overlapping(combo):
            used = set()
            for c in combo:
                if c[0] in used or c[1] in used:
                    return False
                used.add(c[0])
                used.add(c[1])
            return True

        from itertools import combinations as iter_combinations

        for combo in iter_combinations(all_couples, max_couples):
            if not is_non_overlapping(combo):
                continue
            strengths = []
            for c in combo:
                pts = player_points.get(c[0], 0) + player_points.get(c[1], 0) + couple_points.get((c[0], c[1]), 0)
                strengths.append(pts)
            diff = max(strengths) - min(strengths)
            if diff < min_diff:
                min_diff = diff
                best_combo = combo
                best_strengths = strengths

        # 6. Handle leftover player if odd number
        leftover = None
        if n % 2 == 1 and best_combo:
            paired = set()
            for c in best_combo:
                paired.add(c[0])
                paired.add(c[1])
            leftover = [u for u in users if u not in paired]
            leftover = leftover[0] if leftover else None

        couples = [list(c) for c in best_combo] if best_combo else []

        return {
            "couples": couples,
            "leftover": leftover,
            "couple_strengths": best_strengths
        }

    except Exception as e:
        print("Error in /propose_teams:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/link_user_to_player")
async def link_user_to_player(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    player_name = data.get("player_name")  # The old name
    username = data.get("username")        # The user's email
    new_nickname = data.get("nickname")    # The new nickname/email

    if not new_nickname:
        return JSONResponse({"error": "New nickname cannot be empty."}, status_code=400)

    try:
        # 1. Add user to user_groups if not already present
        user_group_exists = supabase.table("user_groups").select("*").eq("username", username).eq("group_id", group_id).execute().data
        if not user_group_exists:
            supabase.table("user_groups").insert({"username": username, "group_id": group_id}).execute()

        # 2. Check for duplicate player name in group
        existing = supabase.table("players").select("*").eq("name", new_nickname).eq("group_id", group_id).execute().data
        if existing and player_name != new_nickname:
            return JSONResponse({"error": f"Player with name '{new_nickname}' already exists in this group."}, status_code=400)

        # 3. Update user's nickname in users table
        supabase.table("users").update({"nickname": new_nickname}).eq("username", username).execute()

        # 4. Update player's name in the group
        update_result = supabase.table("players").update({"name": new_nickname}).eq("group_id", group_id).eq("name", player_name).execute()
        if not update_result.data or (isinstance(update_result.data, list) and len(update_result.data) == 0):
            return JSONResponse({"error": "Player not found in group."}, status_code=404)

        # 5. Update all matches in the group where the old nickname appears
        matches = supabase.table("matches").select("*").eq("group_id", group_id).execute().data
        for match in matches:
            import json
            team1 = match.get("team1", [])
            team2 = match.get("team2", [])
            couples = match.get("couples", [])

            if isinstance(team1, str):
                try: team1 = json.loads(team1)
                except Exception: team1 = []
            if isinstance(team2, str):
                try: team2 = json.loads(team2)
                except Exception: team2 = []
            if isinstance(couples, str):
                try: couples = json.loads(couples)
                except Exception: couples = []

            new_team1 = [new_nickname if p == player_name else p for p in team1]
            new_team2 = [new_nickname if p == player_name else p for p in team2]
            new_couples = [[new_nickname if p == player_name else p for p in couple] for couple in couples]

            if team1 != new_team1 or team2 != new_team2 or couples != new_couples:
                supabase.table("matches").update({

                    "team1": json.dumps(new_team1),
                    "team2": json.dumps(new_team2),
                    "couples": json.dumps(new_couples)
                }).eq("id", match["id"]).execute()

        return {"message": "User linked to player and nicknames updated"}
    except Exception as e:
        print("Error in /link_user_to_player:", e)
        return JSONResponse({"error": str(e)}, status_code=500)
    
@app.post("/register_in_group")
async def register_in_group(request: Request):
    data = await request.json()
    username = data.get("name")  # or data.get("username")
    group_id = data.get("group_id")
    nickname = data.get("nickname")
    try:
        # Insert into user_groups if not already present
        existing = supabase.table("user_groups").select("*").eq("username", username).eq("group_id", group_id).execute().data
        if not existing:
            supabase.table("user_groups").insert({"username": username, "group_id": group_id}).execute()
        # Optionally update nickname
        if nickname:
            supabase.table("users").update({"nickname": nickname}).eq("username", username).execute()
        return {"message": "User registered in group!"}
    except Exception as e:
        print("Error in /register_in_group:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/get_nickname")
def get_nickname(username: str):
    try:
        user = supabase.table("users").select("nickname").eq("username", username).execute()
        data = getattr(user, "data", None)
        if data and isinstance(data, list) and len(data) > 0 and "nickname" in data[0]:
            return {"nickname": data[0]["nickname"]}
        return {"nickname": ""}
    except Exception as e:
        print("Error in /get_nickname:", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# --- Last Games Endpoint ---
@app.get("/last_games")
def last_games(group_id: str, limit: int = 10):
    try:
        matches = supabase.table("matches").select("*") \
            .eq("group_id", group_id) \
            .order("match_date", desc=True) \
            .limit(limit).execute().data
        players = supabase.table("players").select("id, name").eq("group_id", group_id).execute().data
        id_to_name = {p["id"]: p["name"] for p in players}

        result = []
        for m in matches:
            # Parse team1/team2
            team1 = m.get("team1", [])
            team2 = m.get("team2", [])
            import json
            if isinstance(team1, str):
                try:
                    team1 = json.loads(team1)
                except Exception:
                    team1 = []
            if isinstance(team2, str):
                try:
                    team2 = json.loads(team2)
                except Exception:
                    team2 = []

            # Parse sets
            sets = m.get("sets", [])
            if isinstance(sets, str):
                try:
                    sets = json.loads(sets)
                except Exception:
                    sets = []

            # Ensure sets is a list of [int, int]
            sets = [s if isinstance(s, list) and len(s) == 2 else [0, 0] for s in sets]

            score1 = sum(1 for s in sets if s[0] > s[1]) if sets else None
            score2 = sum(1 for s in sets if s[1] > s[0]) if sets else None

            # Format sets as "6-4, 3-6, 7-5"
            sets_string = ', '.join(f"{s[0]}-{s[1]}" for s in sets) if sets else ""

            team1_names = [id_to_name.get(pid, pid) for pid in team1]
            team2_names = [id_to_name.get(pid, pid) for pid in team2]

            result.append({
                "date": m.get("match_date"),
                "team1": team1_names,
                "team2": team2_names,
                "score1": score1,
                "score2": score2,
                "sets": sets,
                "sets_string": sets_string,
                "result": m.get("result", "")
            })
        return {"games": result}
    except Exception as e:
        print("Error in /last_games:", e)
        return JSONResponse({"error": str(e)}, status_code=500)


# --- all Games Endpoint ---
@app.get("/matches")
def get_matches(group_id: Optional[str] = Query(None)):
    try:
        query = supabase.table("matches").select("*")
        if group_id:
            query = query.eq("group_id", group_id)
        matches = query.execute().data
        players = supabase.table("players").select("id, name").eq("group_id", group_id).execute().data
        id_to_name = {p["id"]: p["name"] for p in players}
        result = []
        for m in matches:
            import json
            team1 = m.get("team1", [])
            team2 = m.get("team2", [])
            if isinstance(team1, str):
                try: team1 = json.loads(team1)
                except Exception: team1 = []
            if isinstance(team2, str):
                try: team2 = json.loads(team2)
                except Exception: team2 = []
            sets = m.get("sets", [])
            if isinstance(sets, str):
                try: sets = json.loads(sets)
                except Exception: sets = []
            sets = [s if isinstance(s, list) and len(s) == 2 else [0, 0] for s in sets]
            sets_string = ', '.join(f"{s[0]}-{s[1]}" for s in sets) if sets else ""
            result.append({
                "id": m.get("id"),
                "date": m.get("match_date"),
                "team1": [id_to_name.get(pid, pid) for pid in team1],
                "team2": [id_to_name.get(pid, pid) for pid in team2],
                "team1_raw": team1,  # <-- raw names/IDs
                "team2_raw": team2,
                "sets": sets,
                "sets_string": sets_string,
                "score1": sum(1 for s in sets if s[0] > s[1]) if sets else None,
                "score2": sum(1 for s in sets if s[1] > s[0]) if sets else None,
            })
        return {"matches": result}
    except Exception as e:
        print("Error in /matches:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/all_results")
def all_results(group_id: str, limit: int = 100):
    try:
        matches = supabase.table("matches").select("*") \
            .eq("group_id", group_id) \
            .order("match_date", desc=True) \
            .limit(limit).execute().data
        players = supabase.table("players").select("id, name").eq("group_id", group_id).execute().data
        id_to_name = {p["id"]: p["name"] for p in players}
        result = []
        for m in matches:
            import json
            team1 = m.get("team1", [])
            team2 = m.get("team2", [])
            if isinstance(team1, str):
                try: team1 = json.loads(team1)
                except Exception: team1 = []
            if isinstance(team2, str):
                try: team2 = json.loads(team2)
                except Exception: team2 = []
            sets = m.get("sets", [])
            if isinstance(sets, str):
                try: sets = json.loads(sets)
                except Exception: sets = []
            sets = [s if isinstance(s, list) and len(s) == 2 else [0, 0] for s in sets]
            sets_string = ', '.join(f"{s[0]}-{s[1]}" for s in sets) if sets else ""
            result.append({
                "id": m.get("id"),
                "date": m.get("match_date"),
                "team1": [id_to_name.get(pid, pid) for pid in team1],
                "team2": [id_to_name.get(pid, pid) for pid in team2],
                "team1_raw": team1,  # <-- raw names/IDs
                "team2_raw": team2,
                "sets": sets,
                "sets_string": sets_string,
                "score1": sum(1 for s in sets if s[0] > s[1]) if sets else None,
                "score2": sum(1 for s in sets if s[1] > s[0]) if sets else None,
            })
        return {"games": result}
    except Exception as e:
        print("Error in /all_results:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- edit Games Endpoint ---
@app.post("/edit_result")
async def edit_result(request: Request):
    data = await request.json()
    match_id = data.get("match_id")
    group_id = data.get("group_id")
    sets = data.get("sets")
    team1 = data.get("team1")
    team2 = data.get("team2")
    try:
        supabase.table("matches").update({
            "sets": sets,
            "team1": team1,
            "team2": team2
        }).eq("id", match_id).execute()
        update_ratings_for_group(group_id)
        return {"message": "Result updated and points recalculated."}
    except Exception as e:
        print("Error in /edit_result:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Delete Games Endpoint ---
@app.post("/delete_result")
async def delete_result(request: Request):
    data = await request.json()
    match_id = data.get("match_id")
    group_id = data.get("group_id")
    try:
        supabase.table("matches").delete().eq("id", match_id).execute()
        update_ratings_for_group(group_id)
        return {"message": "Result deleted and points recalculated."}
    except Exception as e:
        print("Error in /delete_result:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/recalculate_points")
def recalculate_points(group_id: str):
    try:
        update_ratings_for_group(group_id)
        return {"message": "Points recalculated successfully."}
    except Exception as e:
        print("Error in /recalculate_points:", e)
        return JSONResponse({"error": str(e)}, status_code=500)