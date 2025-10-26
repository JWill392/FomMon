import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import {ProjectService} from "../project/project.service";
import {AppConfigService} from "../../config/app-config.service";

/// UNUSED currently
@Component({
  selector: 'project-table',
  templateUrl: './project-table.html',
  styleUrl: './project-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTable {
  private projectService = inject(ProjectService);
  private appConfig = inject(AppConfigService);
  projects = this.projectService.data;

  page = signal(1);
  pageSize = signal(20);

  pagedProjects = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.projects().slice(start, start + this.pageSize());
  });

  totalPages = computed(() => {return Math.ceil(this.projects().length / this.pageSize());});
  canGoNext = computed(() => this.page() * this.pageSize() < this.projects().length);
  canGoPrev = computed(() => this.page() > 1);

  protected fomApiUrl = this.appConfig.get().fom.apiUrl;

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
