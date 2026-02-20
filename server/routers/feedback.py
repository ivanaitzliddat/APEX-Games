from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.dependencies import get_current_user
from server.models.db_models import GeneralFeedback, User

router = APIRouter()


class FeedbackSubmit(BaseModel):
    content: str


@router.get("/feedback")
async def list_feedback(db: AsyncSession = Depends(get_db)):
    """Return all feedback text, anonymously."""
    result = await db.execute(
        select(GeneralFeedback.content).order_by(GeneralFeedback.updated_at.desc())
    )
    contents = result.scalars().all()
    return {"feedback": contents}


@router.get("/feedback/mine")
async def get_my_feedback(
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's own feedback for editing."""
    if user is None:
        return {"content": None}

    result = await db.execute(
        select(GeneralFeedback).where(GeneralFeedback.user_id == user.id)
    )
    fb = result.scalar_one_or_none()
    return {"content": fb.content if fb else None}


@router.post("/feedback")
async def submit_feedback(
    req: FeedbackSubmit,
    user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit or update the current user's feedback (upsert)."""
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Feedback cannot be empty")
    if len(content) > 2000:
        raise HTTPException(status_code=400, detail="Feedback too long (max 2000 characters)")

    result = await db.execute(
        select(GeneralFeedback).where(GeneralFeedback.user_id == user.id)
    )
    fb = result.scalar_one_or_none()

    if fb:
        fb.content = content
        fb.updated_at = datetime.utcnow()
    else:
        fb = GeneralFeedback(user_id=user.id, content=content)
        db.add(fb)

    await db.commit()
    return {"ok": True}
