from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
import logging
import os
import uuid

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
SECRET = os.environ.get("JWT_SECRET", "maestrasred-local-secret")

# Free tier: users on the free plan only see the best-rated professionals.
FREE_MIN_RATING = 4.5

app = FastAPI(title="MaestrasRed API")
api_router = APIRouter(prefix="/api")


class AuthInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: dict


class ProviderCreate(BaseModel):
    name: str = Field(min_length=2)
    category: str = Field(min_length=3)
    bio: str = Field(min_length=10)
    rate: float = Field(gt=0)
    city: str = Field(min_length=2)
    commune: str = Field(min_length=2)
    whatsapp: str = Field(min_length=7)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=500)


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)


def public_user(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"], "email": user["email"], "plan": user.get("plan", "free")}


def make_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=14)},
        SECRET,
        algorithm="HS256",
    )


async def current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar")
    try:
        payload = jwt.decode(authorization[7:], SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Sesión inválida") from exc
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def seed_providers() -> None:
    seed = [
        {"id": "p-ana", "name": "Ana Morales", "category": "Profesora", "bio": "Profesora de lenguaje y apoyo escolar con 8 años de experiencia. Clases cercanas, claras y adaptadas a cada ritmo.", "rate": 14000, "city": "Santiago", "commune": "Providencia", "whatsapp": "+56987654321", "rating": 4.9, "reviews_count": 42, "distance": 1.8, "verified": True, "initials": "AM"},
        {"id": "p-valentina", "name": "Valentina Rojas", "category": "Profesora", "bio": "Educadora diferencial enfocada en acompañar procesos de aprendizaje con paciencia y herramientas prácticas.", "rate": 16000, "city": "Santiago", "commune": "Ñuñoa", "whatsapp": "+56976543210", "rating": 4.8, "reviews_count": 31, "distance": 3.4, "verified": True, "initials": "VR"},
        {"id": "p-camila", "name": "Camila Soto", "category": "Profesora", "bio": "Clases de matemáticas para enseñanza básica y media. Planes personalizados y seguimiento semanal.", "rate": 12500, "city": "Santiago", "commune": "La Reina", "whatsapp": "+56965432109", "rating": 4.7, "reviews_count": 27, "distance": 5.1, "verified": False, "initials": "CS"},
        {"id": "p-daniela", "name": "Daniela Paredes", "category": "Profesora", "bio": "Profesora de inglés para niños, jóvenes y adultos. Preparación de pruebas y conversación desde el primer día.", "rate": 13000, "city": "Santiago", "commune": "Ñuñoa", "whatsapp": "+56961112233", "rating": 4.2, "reviews_count": 18, "distance": 4.2, "verified": False, "initials": "DP"},
        {"id": "p-francisca", "name": "Francisca Lara", "category": "Niñera", "bio": "Niñera con 10 años de experiencia en cuidado de bebés y niños escolares. Primeros auxilios y referencias verificables.", "rate": 15000, "city": "Santiago", "commune": "Las Condes", "whatsapp": "+56998887766", "rating": 4.9, "reviews_count": 51, "distance": 2.6, "verified": True, "initials": "FL"},
        {"id": "p-javiera", "name": "Javiera Núñez", "category": "Niñera", "bio": "Niñera vespertina para apoyo con tareas, traslados y cuidado después del colegio. Vehículo propio.", "rate": 11000, "city": "Santiago", "commune": "Macul", "whatsapp": "+56955544332", "rating": 3.9, "reviews_count": 12, "distance": 6.3, "verified": False, "initials": "JN"},
        {"id": "p-marcela", "name": "Marcela Fuentes", "category": "Gasfitera", "bio": "Gasfitera certificada SEC. Instalaciones de gas y agua, detección de fugas y emergencias con garantía escrita.", "rate": 18000, "city": "Santiago", "commune": "Santiago Centro", "whatsapp": "+56977788899", "rating": 4.9, "reviews_count": 36, "distance": 2.1, "verified": True, "initials": "MF"},
        {"id": "p-paula", "name": "Paula Contreras", "category": "Gasfitera", "bio": "Reparaciones e instalaciones de gasfitería para hogares y edificios. Presupuesto sin costo en la comuna.", "rate": 16000, "city": "Santiago", "commune": "Providencia", "whatsapp": "+56966655544", "rating": 4.4, "reviews_count": 19, "distance": 1.5, "verified": False, "initials": "PC"},
        {"id": "p-soledad", "name": "Soledad Bravo", "category": "Jardinera", "bio": "Jardinera y paisajista. Diseño, mantención mensual y recuperación de jardines con plantas nativas.", "rate": 13000, "city": "Santiago", "commune": "La Reina", "whatsapp": "+56944433322", "rating": 4.8, "reviews_count": 24, "distance": 5.8, "verified": True, "initials": "SB"},
        {"id": "p-carolina", "name": "Carolina Vega", "category": "Jardinera", "bio": "Mantención de jardines, poda de arbustos e instalación de riego automático. Trabajo ordenado y puntual.", "rate": 12000, "city": "Santiago", "commune": "Las Condes", "whatsapp": "+56933322211", "rating": 4.3, "reviews_count": 15, "distance": 3.9, "verified": False, "initials": "CV"},
    ]
    for item in seed:
        await db.providers.update_one({"id": item["id"]}, {"$setOnInsert": item}, upsert=True)


@app.on_event("startup")
async def startup() -> None:
    await seed_providers()


@api_router.get("/")
async def root():
    return {"message": "MaestrasRed API activa"}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(data: AuthInput):
    email = data.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="Este correo ya está registrado")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data.name or email.split("@")[0].title(),
        "password_hash": bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode(),
        "plan": "free",
    }
    await db.users.insert_one(user)
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(data: AuthInput):
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api_router.post("/users/upgrade")
async def upgrade(user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"plan": "premium"}})
    return {**public_user(user), "plan": "premium"}


@api_router.get("/providers")
async def providers(
    search: str = "",
    commune: str = "",
    category: str = "",
    min_rating: float = Query(0, ge=0, le=5),
    user: dict = Depends(current_user),
):
    limited = user.get("plan", "free") != "premium"
    floor = max(min_rating, FREE_MIN_RATING) if limited else min_rating
    query: dict = {"rating": {"$gte": floor}}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"bio": {"$regex": search, "$options": "i"}},
        ]
    if commune:
        query["commune"] = {"$regex": commune, "$options": "i"}
    items = await db.providers.find(query, {"_id": 0}).sort([("rating", -1), ("reviews_count", -1)]).to_list(100)
    return {"providers": items, "limited": limited}


@api_router.get("/providers/{provider_id}")
async def provider(provider_id: str):
    item = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Profesional no encontrada")
    reviews = await db.reviews.find({"provider_id": provider_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {**item, "reviews": reviews}


@api_router.post("/providers/{provider_id}/reviews")
async def review(provider_id: str, data: ReviewCreate, user: dict = Depends(current_user)):
    if not await db.providers.find_one({"id": provider_id}, {"_id": 0}):
        raise HTTPException(status_code=404, detail="Profesional no encontrada")
    review_doc = {
        "id": str(uuid.uuid4()),
        "provider_id": provider_id,
        "user_name": user["name"],
        "rating": data.rating,
        "comment": data.comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(review_doc)
    review_doc.pop("_id", None)
    ratings = await db.reviews.find({"provider_id": provider_id}, {"_id": 0, "rating": 1}).to_list(None)
    average = round(sum(r["rating"] for r in ratings) / len(ratings), 1)
    await db.providers.update_one(
        {"id": provider_id},
        {"$set": {"rating": average, "reviews_count": len(ratings)}},
    )
    return {key: value for key, value in review_doc.items() if key != "_id"}


@api_router.post("/providers")
async def create_provider(data: ProviderCreate, user: dict = Depends(current_user)):
    item = data.model_dump() | {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "rating": 0,
        "reviews_count": 0,
        "distance": 0,
        "verified": False,
        "initials": "".join(word[0] for word in data.name.split()[:2]).upper(),
    }
    await db.providers.insert_one(item)
    item.pop("_id", None)
    return item


@api_router.get("/conversations")
async def conversations(user: dict = Depends(current_user)):
    return await db.conversations.find({"participants": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(50)


@api_router.post("/conversations/{provider_id}")
async def create_conversation(provider_id: str, user: dict = Depends(current_user)):
    item = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Profesional no encontrada")
    conversation = await db.conversations.find_one({"user_id": user["id"], "provider_id": provider_id}, {"_id": 0})
    if conversation:
        return conversation
    conversation = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "provider_id": provider_id,
        "provider_name": item["name"],
        "provider_initials": item["initials"],
        "participants": [user["id"], provider_id],
        "last_message": "Inicia una conversación",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.conversations.insert_one(conversation)
    conversation.pop("_id", None)
    return conversation


@api_router.get("/conversations/{conversation_id}/messages")
async def messages(conversation_id: str, user: dict = Depends(current_user)):
    conversation = await db.conversations.find_one({"id": conversation_id, "participants": user["id"]}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return await db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(100)


@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, data: MessageCreate, user: dict = Depends(current_user)):
    conversation = await db.conversations.find_one({"id": conversation_id, "participants": user["id"]}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user["id"],
        "text": data.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(message)
    message.pop("_id", None)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_message": data.text, "updated_at": message["created_at"]}})
    return message


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
