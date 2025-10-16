import { Point } from 'geojson';

export interface Project {
  id: number;
  name: string;
  geometry: Point;
  state: ProjectState;
  stateDescription: string;
  publicNotice?: PublicNotice | null;
}

export interface PublicNotice {
  postDate: Date;
  companyId: string;
  companyName: string;
  description: string;
  operationStartYear: number;
  operationEndYear: number;
}

export type Projects = Project[];


export enum ProjectState {
  commentOpen = 1,
  commentClosed = 2,
  initial = 3,
  published = 4,
  finalized = 5,
  expired = 6,
}

// Factory for Project
export class ProjectFactory {
  static fromJson(json: any): Project {
    return {
      id: json.id,
      name: json.name,
      geometry: json.geometry as Point,
      state: ProjectFactory.parseProjectState(json.state as keyof typeof ProjectState),
      stateDescription: json.stateDescription,
      publicNotice: json.publicNotice
        ? {
            postDate: new Date(json.publicNotice.postDate),
            companyId: json.publicNotice.companyId,
            companyName: json.publicNotice.companyName,
            description: json.publicNotice.description,
            operationStartYear: json.publicNotice.operationStartYear,
            operationEndYear: json.publicNotice.operationEndYear
          }
        : null
    };
  }

  static parseProjectState(value: keyof typeof ProjectState): ProjectState {
    return ProjectState[value];
  }
}
