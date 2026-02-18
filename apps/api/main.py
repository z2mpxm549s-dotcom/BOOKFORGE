from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import research, books, health

app = FastAPI(title="BOOKFORGE API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(research.router, prefix="/api/research", tags=["Market Research"])
app.include_router(books.router, prefix="/api/books", tags=["Book Generation"])
