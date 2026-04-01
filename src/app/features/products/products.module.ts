import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductFormComponent } from './components/product-form/product-form.component';
import { ServiceFormComponent } from './components/service-form/service-form.component';
import { CashFormComponent } from './components/cash-form/cash-form.component';
import { InventoryFormComponent } from './components/inventory-form/inventory-form.component';
import { SupportFormComponent } from './components/support-form/support-form.component';
import { AccessPanelComponent } from './components/access-panel/access-panel.component';

@NgModule({
  declarations: [
    ProductListComponent,
    ProductFormComponent,
    ServiceFormComponent,
    CashFormComponent,
    InventoryFormComponent,
    SupportFormComponent,
    AccessPanelComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  exports: [
    ProductListComponent,
    ProductFormComponent,
    ServiceFormComponent,
    CashFormComponent,
    InventoryFormComponent,
    SupportFormComponent,
    AccessPanelComponent
  ]
})
export class ProductsModule { }
