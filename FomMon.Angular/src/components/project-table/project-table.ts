import { Component, Input, signal, computed, ChangeDetectionStrategy, Inject, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {ProjectService} from "../project/project.service";

/// UNUSED currently
@Component({
  selector: 'project-table',
  templateUrl: './project-table.html',
  styleUrl: './project-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTable {
  private projectService = inject(ProjectService);
  projects = this.projectService.data;

  environment = environment;
  page = signal(1);
  pageSize = signal(20);

  pagedProjects = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.projects().slice(start, start + this.pageSize());
  });

  totalPages = computed(() => {return Math.ceil(this.projects().length / this.pageSize());});
  canGoNext = computed(() => this.page() * this.pageSize() < this.projects().length);
  canGoPrev = computed(() => this.page() > 1);

  nextPage() { 
    if (this.canGoNext()) {
      this.page.update(p => p + 1);
    }
  }

  prevPage() {
    if (this.canGoPrev()) {
      this.page.update(p => p - 1);
    }
  }
}
