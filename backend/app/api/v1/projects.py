from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.api import deps
from app.models.models import Project, User

router = APIRouter()

class ProjectCreate(BaseModel):
    name: str
    description: str = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str = None

    class Config:
        from_attributes = True

@router.post("/create", response_model=ProjectResponse)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    project = db.query(Project).filter(Project.name == project_in.name).first()
    if project:
        raise HTTPException(status_code=400, detail="Project name already exists.")
    
    db_project = Project(name=project_in.name, description=project_in.description)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/list", response_model=List[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    return db.query(Project).all()
