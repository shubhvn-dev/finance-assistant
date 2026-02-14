import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the database connection pool."""
    global _pool

    if _pool is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL environment variable is not set")

        _pool = await asyncpg.create_pool(
            database_url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )

    return _pool


async def close_pool() -> None:
    """Close the database connection pool."""
    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get a database connection from the pool."""
    pool = await get_pool()

    async with pool.acquire() as connection:
        yield connection
