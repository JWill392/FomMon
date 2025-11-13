import {Component, computed, contentChild, input, ResourceRef} from '@angular/core';
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {ServiceState} from "../service/service-state";

@Component({
  selector: 'app-loader-placeholder',
  template: '<ng-content />',
})
export class LoaderPlaceholderComponent {
}

@Component({
  selector: 'app-loader',
  imports: [
    MatProgressSpinner
  ],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.scss'
})
export class LoaderComponent {
  dependentStateInput = input<ServiceState[]>([], {alias: "dependentStates"});
  dependentResourceInput = input<(ResourceRef<any> | undefined)[]>([], {alias: "dependentResources"});
  isLoadingInput = input<boolean>(false, {alias: "loading"});


  errorInput = input(undefined, {
    transform: (v: Error) => v?.message,
    alias: "error"
  });

  diameter = input<number>(40);
  strokeWidth = input<number>(4);

  isLoadingOrIdle = computed(() => this.isLoadingInput() ||
    this.dependentStateInput().some(s => s.isLoading() || s.isIdle()) ||
    this.dependentResourceInput().some(r => !r || r.isLoading()));

  error = computed(() => this.errorInput() || this.dependentStateInput().find(s => s.isError())?.error());

  placeholderContent = contentChild(LoaderPlaceholderComponent);
  hasPlaceholder = computed(() => !!this.placeholderContent());


}
