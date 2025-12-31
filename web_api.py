from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
import uuid
import main  # <-- Import your business logic and supabase client

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://padel-chi.vercel.app"],
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

        for res in results:
            team1_ids = sorted(res["team1"])
            team2_ids = sorted(res["team2"])
            if len(team1_ids) != 2 or len(team2_ids) != 2:
                return {"error": "Each team must have exactly 2 player IDs."}

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
    username = data.get("username")
    nickname = data.get("nickname")
    try:
        supabase.table("users").update({"nickname": nickname}).eq("username", username).execute()
        return {"message": "Nickname updated!"}
    except Exception as e:
        print("Error in /set_nickname:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Propose Teams Endpoint ---
@app.get("/propose_teams")
def propose_teams(group_id: str, match_date: str):
    try:
        match = supabase.table("next_matches").select("*").eq("group_id", group_id).eq("match_date", match_date).execute().data
        if not match:
            return {"teams": []}
        users = match[0].get("registered_users", [])
        half = len(users) // 2
        teams = [users[:half],users[half:]]
        return {"teams": teams}
    except Exception as e:
        print("Error in /propose_teams:", e)
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/link_user_to_player")
async def link_user_to_player(request: Request):
    data = await request.json()
    group_id = data.get("group_id")
    player_name = data.get("player_name")
    username = data.get("username")
    # Update the player record to link to this user (e.g., add a "username" field)
    supabase.table("players").update({"username": username}).eq("group_id", group_id).eq("name", player_name).execute()
    return {"message": "User linked to player"}

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
def last_games(group_id: str):
    try:
        matches = supabase.table("matches").select("*").eq("group_id", group_id).order("match_date", desc=True).limit(5).execute().data
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
                "sets_string": sets_string,
                "result": m.get("result", "")
            })
        return {"games": result}
    except Exception as e:
        print("Error in /last_games:", e)
        return JSONResponse({"error": str(e)}, status_code=500)