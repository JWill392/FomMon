import { Component, Input, signal, computed, ChangeDetectionStrategy, Inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Projects } from '../../types/project';
import { environment } from '../../environments/environment';

@Component({
  selector: 'project-table',
  templateUrl: './project-table.html',
  styleUrl: './project-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTable {
  @Input() projects = signal<Projects>([]);

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
