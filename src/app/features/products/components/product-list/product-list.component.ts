import { Component, OnDestroy, OnInit } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { DEFAULT_PRODUCT_IMAGE, SupabaseService } from '../../../../core/services/supabase.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { CashInsight, CashMovement, CashPeriodPreset, CashTrendPoint } from '../../models/cash';
import { InventoryItem, InventoryMovement } from '../../models/inventory';
import { Product, SalonService } from '../../models/product';
import {
  SupportAssistantContext,
  SupportFaqItem,
  SupportModuleArea,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus
} from '../../models/support';

type ActiveSection = 'products' | 'services' | 'cash' | 'inventory' | 'support';
type InventoryStockFilter = 'all' | 'low' | 'healthy';

interface CashReportItem {
  label: string;
  value: string;
  tone: 'income' | 'expense' | 'neutral';
}

interface InventoryAlert {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  level: 'critical' | 'warning';
}

interface InventoryInsight {
  title: string;
  description: string;
  level: 'good' | 'warning' | 'neutral';
}

interface SupportInsight {
  title: string;
  description: string;
  level: 'good' | 'warning' | 'neutral';
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  activeSection: ActiveSection = 'products';
  currentUserEmail: string | null = null;
  isAdmin = false;
  isAuthReady = false;
  isSendingAdminAccessLink = false;

  products: Product[] = [];
  services: SalonService[] = [];
  cashMovements: CashMovement[] = [];
  inventoryItems: InventoryItem[] = [];
  inventoryMovements: InventoryMovement[] = [];
  supportTickets: SupportTicket[] = [];

  isLoadingProducts = false;
  isLoadingServices = false;
  isLoadingCash = false;
  isLoadingInventory = false;
  isLoadingSupport = false;

  productsErrorMessage = '';
  servicesErrorMessage = '';
  cashErrorMessage = '';
  inventoryErrorMessage = '';
  supportErrorMessage = '';

  deletingProductId: string | null = null;
  deletingServiceId: string | null = null;
  deletingCashMovementId: string | null = null;
  deletingInventoryMovementId: string | null = null;
  updatingSupportTicketId: string | null = null;

  editingProduct: Product | null = null;
  editingService: SalonService | null = null;
  editingCashMovement: CashMovement | null = null;
  editingInventoryItem: InventoryItem | null = null;
  editingInventoryMovement: InventoryMovement | null = null;
  editingSupportTicket: SupportTicket | null = null;

  cashPeriodPreset: CashPeriodPreset = 'month';
  cashRangeStart = this.getMonthStartValue();
  cashRangeEnd = this.getTodayValue();
  lastCashClosureGeneratedAt: Date | null = null;

  inventoryCategoryFilter = 'all';
  inventorySearchTerm = '';
  inventoryStockFilter: InventoryStockFilter = 'all';

  readonly defaultImageUrl = DEFAULT_PRODUCT_IMAGE;
  private readonly quickAdminStorageKey = 'peluq-aba-quick-admin';
  private authSubscription?: { unsubscribe(): void };
  private hasLoadedAdminModules = false;

  private readonly currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  });
  private readonly quantityFormatter = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 2
  });
  private readonly shortDateFormatter = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short'
  });
  private readonly longDateFormatter = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  constructor(
    private supabaseService: SupabaseService,
    private notificationService: NotificationService,
    private themeService: ThemeService
  ) {}

  get isDarkTheme(): boolean {
    return this.themeService.isDarkTheme;
  }

  get themeToggleLabel(): string {
    return this.isDarkTheme ? 'Modo claro' : 'Modo oscuro';
  }

  get adminEmail(): string {
    return this.supabaseService.getAdminEmail();
  }

  get heroLead(): string {
    return this.isAdmin
      ? 'Administra productos, servicios, caja, inventario y soporte desde un solo lugar.'
      : 'Explora productos y servicios en un modo de consulta pensado para usuarios del sistema.';
  }

  get sectionSwitcherColumnCount(): number {
    return this.isAdmin ? 5 : 2;
  }

  get totalProducts(): number {
    return this.products.length;
  }

  get productsWithCustomImage(): number {
    return this.products.filter((product) => !!product.image_path).length;
  }

  get averageProductPrice(): number {
    if (!this.products.length) {
      return 0;
    }

    return this.products.reduce((sum, product) => sum + Number(product.price), 0) / this.products.length;
  }

  get catalogValue(): number {
    return this.products.reduce((sum, product) => sum + Number(product.price), 0);
  }

  get latestProductName(): string {
    return this.products[0]?.name || 'Aun sin registros';
  }

  get totalServices(): number {
    return this.services.length;
  }

  get averageServicePrice(): number {
    if (!this.services.length) {
      return 0;
    }

    return this.services.reduce((sum, service) => sum + Number(service.price), 0) / this.services.length;
  }

  get averageServiceDuration(): number {
    if (!this.services.length) {
      return 0;
    }

    const total = this.services.reduce((sum, service) => sum + Number(service.duration_minutes), 0);
    return Math.round(total / this.services.length);
  }

  get averageServiceDurationLabel(): string {
    return this.formatDuration(this.averageServiceDuration);
  }

  get mainServiceCategory(): string {
    if (!this.services.length) {
      return 'Sin categoria';
    }

    const totalsByCategory = this.services.reduce<Record<string, number>>((accumulator, service) => {
      accumulator[service.category] = (accumulator[service.category] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(totalsByCategory).sort((left, right) => right[1] - left[1])[0]?.[0] || 'Sin categoria';
  }

  get featuredServiceName(): string {
    return this.services[0]?.name || 'Sin servicios';
  }

  get filteredCashMovements(): CashMovement[] {
    const { start, end } = this.getNormalizedCashRange();
    return this.cashMovements.filter((movement) => movement.movement_date >= start && movement.movement_date <= end);
  }

  get cashIncomeTotal(): number {
    return this.filteredCashMovements
      .filter((movement) => movement.type === 'income')
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
  }

  get cashExpenseTotal(): number {
    return this.filteredCashMovements
      .filter((movement) => movement.type === 'expense')
      .reduce((sum, movement) => sum + Number(movement.amount), 0);
  }

  get cashBalance(): number {
    return this.cashIncomeTotal - this.cashExpenseTotal;
  }

  get cashMovementCount(): number {
    return this.filteredCashMovements.length;
  }

  get totalCashMovements(): number {
    return this.cashMovements.length;
  }

  get latestCashMovementConcept(): string {
    return this.cashMovements[0]?.concept || 'Sin movimientos';
  }

  get totalInventoryItems(): number {
    return this.inventoryItems.length;
  }

  get filteredInventoryItems(): InventoryItem[] {
    const searchTerm = this.inventorySearchTerm.trim().toLowerCase();

    return this.inventoryItems.filter((item) => {
      const matchesCategory = this.inventoryCategoryFilter === 'all' || item.category === this.inventoryCategoryFilter;
      const matchesSearch = !searchTerm
        || item.name.toLowerCase().includes(searchTerm)
        || item.category.toLowerCase().includes(searchTerm)
        || item.unit.toLowerCase().includes(searchTerm)
        || (item.notes || '').toLowerCase().includes(searchTerm);
      const matchesStock = this.inventoryStockFilter === 'all'
        || (this.inventoryStockFilter === 'low' && this.isLowStock(item))
        || (this.inventoryStockFilter === 'healthy' && !this.isLowStock(item));

      return matchesCategory && matchesSearch && matchesStock;
    });
  }

  get filteredInventoryMovements(): InventoryMovement[] {
    const searchTerm = this.inventorySearchTerm.trim().toLowerCase();

    return this.inventoryMovements.filter((movement) => {
      const matchesCategory = this.inventoryCategoryFilter === 'all' || movement.item_category === this.inventoryCategoryFilter;
      const matchesSearch = !searchTerm
        || movement.item_name.toLowerCase().includes(searchTerm)
        || movement.reason.toLowerCase().includes(searchTerm)
        || (movement.reference_label || '').toLowerCase().includes(searchTerm)
        || (movement.notes || '').toLowerCase().includes(searchTerm);

      return matchesCategory && matchesSearch;
    });
  }

  get inventoryCategories(): string[] {
    return Array.from(new Set(this.inventoryItems.map((item) => item.category))).sort((left, right) => left.localeCompare(right));
  }

  get inventoryUnitsOnHand(): number {
    return this.filteredInventoryItems.reduce((sum, item) => sum + Number(item.current_stock), 0);
  }

  get inventoryAlerts(): InventoryAlert[] {
    return this.inventoryItems
      .filter((item) => this.isLowStock(item))
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        currentStock: Number(item.current_stock),
        minStock: Number(item.min_stock),
        unit: item.unit,
        level: this.isCriticalStock(item) ? ('critical' as const) : ('warning' as const)
      }))
      .sort((left, right) => left.currentStock - right.currentStock);
  }

  get lowStockCount(): number {
    return this.inventoryAlerts.length;
  }

  get inventoryMovementCount(): number {
    return this.filteredInventoryMovements.length;
  }

  get inventoryTopRotationLabel(): string {
    const rotationByItem = this.filteredInventoryMovements
      .filter((movement) => movement.movement_type === 'exit')
      .reduce<Record<string, number>>((accumulator, movement) => {
        accumulator[movement.item_name] = (accumulator[movement.item_name] ?? 0) + Number(movement.quantity);
        return accumulator;
      }, {});

    const topRotation = Object.entries(rotationByItem).sort((left, right) => right[1] - left[1])[0];
    return topRotation?.[0] || 'Sin salidas registradas';
  }

  get latestInventoryLabel(): string {
    return this.inventoryMovements[0]?.item_name || this.inventoryItems[0]?.name || 'Sin inventario';
  }

  get inventoryInsights(): InventoryInsight[] {
    if (!this.inventoryItems.length) {
      return [{
        title: 'Inventario listo para iniciar',
        description: 'Crea tu primer item para comenzar a medir niveles de stock, rotacion y necesidades de reposicion.',
        level: 'neutral'
      }];
    }

    const insights: InventoryInsight[] = [];
    const lowStockCount = this.lowStockCount;

    if (lowStockCount === 0) {
      insights.push({
        title: 'Stock controlado',
        description: 'Todos los items estan por encima del minimo configurado. El inventario se ve estable en este momento.',
        level: 'good'
      });
    } else {
      insights.push({
        title: 'Reposicion pendiente',
        description: `${lowStockCount} items estan en nivel minimo o critico. Conviene programar una compra.`,
        level: 'warning'
      });
    }

    if (this.filteredInventoryMovements.length) {
      insights.push({
        title: 'Mayor rotacion detectada',
        description: `${this.inventoryTopRotationLabel} lidera las salidas visibles dentro del filtro actual.`,
        level: 'neutral'
      });
    }

    const itemsWithHealthyMargin = this.inventoryItems.filter((item) =>
      Number(item.current_stock) >= Number(item.min_stock) * 2
    ).length;

    if (itemsWithHealthyMargin >= Math.ceil(this.inventoryItems.length / 2)) {
      insights.push({
        title: 'Cobertura favorable',
        description: 'Mas de la mitad del inventario tiene margen suficiente por encima del minimo.',
        level: 'good'
      });
    }

    return insights.slice(0, 3);
  }

  get inventoryAiNarrative(): string {
    if (!this.inventoryItems.length) {
      return 'El resumen inteligente del inventario aparecera cuando registres items y movimientos.';
    }

    return `Hoy tienes ${this.totalInventoryItems} items registrados, ${this.lowStockCount} alertas activas y ${this.formatQuantity(this.inventoryUnitsOnHand)} unidades disponibles dentro del filtro actual.`;
  }

  get totalSupportTickets(): number {
    return this.supportTickets.length;
  }

  get openSupportTickets(): number {
    return this.supportTickets.filter((ticket) => ticket.status !== 'resolved').length;
  }

  get resolvedSupportTickets(): number {
    return this.supportTickets.filter((ticket) => ticket.status === 'resolved').length;
  }

  get highPrioritySupportTickets(): number {
    return this.supportTickets.filter((ticket) => ticket.priority === 'high').length;
  }

  get latestSupportTicketTitle(): string {
    return this.supportTickets[0]?.title || 'Sin casos registrados';
  }

  get supportContext(): SupportAssistantContext {
    return {
      productCount: this.totalProducts,
      serviceCount: this.totalServices,
      cashMovementCount: this.totalCashMovements,
      inventoryItemCount: this.totalInventoryItems,
      lowStockCount: this.lowStockCount,
      openTicketCount: this.openSupportTickets
    };
  }

  get supportFaqs(): SupportFaqItem[] {
    return [
      {
        question: 'Como empiezo a cargar productos en el sistema?',
        answer: this.totalProducts
          ? `Ya tienes ${this.totalProducts} productos creados. Puedes seguir agregando desde el formulario de Productos con nombre y precio obligatorios.`
          : 'Abre el apartado Productos, completa nombre y precio, y guarda. La imagen y la descripcion son opcionales.',
        module: 'products'
      },
      {
        question: 'Que hago si una salida de inventario no me deja guardar?',
        answer: this.lowStockCount
          ? `Revisa primero las ${this.lowStockCount} alertas de stock activas, porque una salida falla cuando no hay cantidad suficiente disponible.`
          : 'Verifica que el item exista, que tenga stock suficiente y que Supabase tenga la tabla inventory_movements con sus policies.',
        module: 'inventory'
      },
      {
        question: 'Como interpreto el cierre de caja?',
        answer: this.totalCashMovements
          ? 'El cierre resume ingresos, egresos, balance, categoria mas activa y movimientos del rango seleccionado en caja.'
          : 'Primero registra ingresos o egresos en Caja. Cuando haya movimientos, el cierre automatico se activara con el periodo que elijas.',
        module: 'cash'
      },
      {
        question: 'Como doy seguimiento a un problema interno?',
        answer: this.totalSupportTickets
          ? `Ya hay ${this.totalSupportTickets} tickets registrados. Puedes marcar un caso en progreso, resolverlo o reabrirlo desde este mismo modulo.`
          : 'Crea un ticket en Soporte y Ayuda indicando modulo, prioridad, titulo y descripcion. Asi el caso queda trazado.',
        module: 'support'
      }
    ];
  }

  get supportInsights(): SupportInsight[] {
    if (!this.supportTickets.length) {
      return [{
        title: 'Soporte listo para operar',
        description: 'Aun no hay tickets registrados. El modulo esta preparado para resolver dudas y dejar trazabilidad cuando aparezca un caso.',
        level: 'good'
      }];
    }

    const insights: SupportInsight[] = [];

    if (this.openSupportTickets > 0) {
      insights.push({
        title: 'Casos pendientes de atencion',
        description: `${this.openSupportTickets} tickets siguen abiertos o en progreso. Conviene revisarlos para mantener continuidad operativa.`,
        level: 'warning'
      });
    } else {
      insights.push({
        title: 'Bandeja al dia',
        description: 'Todos los casos registrados estan resueltos por ahora.',
        level: 'good'
      });
    }

    if (this.highPrioritySupportTickets > 0) {
      insights.push({
        title: 'Prioridades altas detectadas',
        description: `${this.highPrioritySupportTickets} tickets fueron marcados como alta prioridad.`,
        level: 'warning'
      });
    }

    if (this.resolvedSupportTickets > 0) {
      insights.push({
        title: 'Historial con trazabilidad',
        description: `${this.resolvedSupportTickets} casos ya fueron resueltos y quedan como referencia para incidencias futuras.`,
        level: 'neutral'
      });
    }

    return insights.slice(0, 3);
  }

  get cashTopCategory(): string {
    if (!this.filteredCashMovements.length) {
      return 'Sin categoria';
    }

    const totalsByCategory = this.filteredCashMovements.reduce<Record<string, number>>((accumulator, movement) => {
      accumulator[movement.category] = (accumulator[movement.category] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(totalsByCategory).sort((left, right) => right[1] - left[1])[0]?.[0] || 'Sin categoria';
  }

  get averageCashMovementAmount(): number {
    if (!this.cashMovementCount) {
      return 0;
    }

    return this.filteredCashMovements.reduce((sum, movement) => sum + Number(movement.amount), 0) / this.cashMovementCount;
  }

  get cashTrendPoints(): CashTrendPoint[] {
    const totalsByDate = this.filteredCashMovements.reduce<Record<string, CashTrendPoint>>((accumulator, movement) => {
      if (!accumulator[movement.movement_date]) {
        accumulator[movement.movement_date] = {
          label: this.shortDateFormatter.format(this.toSafeDate(movement.movement_date)),
          income: 0,
          expense: 0
        };
      }

      if (movement.type === 'income') {
        accumulator[movement.movement_date].income += Number(movement.amount);
      } else {
        accumulator[movement.movement_date].expense += Number(movement.amount);
      }

      return accumulator;
    }, {});

    return Object.entries(totalsByDate)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .slice(-7)
      .map((entry) => entry[1]);
  }

  get maxCashTrendValue(): number {
    const maxValue = this.cashTrendPoints.reduce((highest, point) => Math.max(highest, point.income, point.expense), 0);
    return maxValue || 1;
  }

  get selectedCashRangeLabel(): string {
    const { start, end } = this.getNormalizedCashRange();

    if (this.cashPeriodPreset === 'today') {
      return `Hoy, ${this.formatCashDate(start)}`;
    }

    return start === end ? this.formatCashDate(start) : `${this.formatCashDate(start)} al ${this.formatCashDate(end)}`;
  }

  get cashClosureGeneratedLabel(): string {
    return this.lastCashClosureGeneratedAt
      ? this.dateTimeFormatter.format(this.lastCashClosureGeneratedAt)
      : 'Aun no se ha generado un cierre automatico.';
  }

  get cashReportItems(): CashReportItem[] {
    const largestIncome = this.getLargestCashMovement('income');
    const largestExpense = this.getLargestCashMovement('expense');

    return [
      { label: 'Ingresos del periodo', value: this.formatCurrency(this.cashIncomeTotal), tone: 'income' },
      { label: 'Egresos del periodo', value: this.formatCurrency(this.cashExpenseTotal), tone: 'expense' },
      { label: 'Balance neto', value: this.formatCurrency(this.cashBalance), tone: this.cashBalance >= 0 ? 'income' : 'expense' },
      { label: 'Movimientos registrados', value: `${this.cashMovementCount}`, tone: 'neutral' },
      { label: 'Categoria mas activa', value: this.cashTopCategory, tone: 'neutral' },
      { label: 'Promedio por movimiento', value: this.formatCurrency(this.averageCashMovementAmount), tone: 'neutral' },
      { label: 'Mayor ingreso', value: largestIncome ? `${this.formatCurrency(largestIncome.amount)} | ${largestIncome.concept}` : 'Sin ingresos registrados', tone: 'income' },
      { label: 'Mayor egreso', value: largestExpense ? `${this.formatCurrency(largestExpense.amount)} | ${largestExpense.concept}` : 'Sin egresos registrados', tone: 'expense' }
    ];
  }

  get cashInsights(): CashInsight[] {
    if (!this.filteredCashMovements.length) {
      return [{
        title: 'Sin historial suficiente',
        description: 'Registra ingresos y egresos para obtener recomendaciones automaticas del comportamiento financiero.',
        level: 'neutral'
      }];
    }

    const insights: CashInsight[] = [];
    const largestExpense = this.getLargestCashMovement('expense');

    if (this.cashBalance > 0) {
      insights.push({
        title: 'Caja con margen positivo',
        description: `El balance del periodo esta en ${this.formatCurrency(this.cashBalance)}, lo que indica un flujo saludable.`,
        level: 'good'
      });
    } else if (this.cashBalance < 0) {
      insights.push({
        title: 'Alerta de desequilibrio',
        description: `Los egresos superan a los ingresos por ${this.formatCurrency(Math.abs(this.cashBalance))}. Conviene revisar gastos y precios.`,
        level: 'warning'
      });
    } else {
      insights.push({
        title: 'Balance neutro',
        description: 'Ingresos y egresos estan iguales en el periodo actual. Un pequeno ajuste puede dejar la caja en positivo.',
        level: 'neutral'
      });
    }

    if (this.cashExpenseTotal > 0 && largestExpense && largestExpense.amount >= this.cashExpenseTotal * 0.45) {
      insights.push({
        title: 'Gasto dominante detectado',
        description: `"${largestExpense.concept}" representa una parte alta de los egresos del periodo.`,
        level: 'warning'
      });
    } else if (this.cashIncomeTotal > 0 && this.cashExpenseTotal <= this.cashIncomeTotal * 0.55) {
      insights.push({
        title: 'Buen control de costos',
        description: 'Los egresos se mantienen por debajo del ritmo de ingresos y eso protege la rentabilidad del salon.',
        level: 'good'
      });
    }

    if (insights.length < 3) {
      insights.push({
        title: 'Categoria mas movida',
        description: `La categoria con mas actividad en este rango es ${this.cashTopCategory}.`,
        level: 'neutral'
      });
    }

    return insights.slice(0, 3);
  }

  get cashAiNarrative(): string {
    if (!this.filteredCashMovements.length) {
      return 'El resumen inteligente aparecera cuando registres movimientos de caja en el periodo seleccionado.';
    }

    return `En ${this.selectedCashRangeLabel} se registran ${this.cashMovementCount} movimientos. Los ingresos suman ${this.formatCurrency(this.cashIncomeTotal)} y los egresos ${this.formatCurrency(this.cashExpenseTotal)}, dejando un balance de ${this.formatCurrency(this.cashBalance)}.`;
  }

  async ngOnInit(): Promise<void> {
    await this.restoreAccessState();

    let skipInitialAuthEvent = true;
    this.authSubscription = this.supabaseService.onAuthEmailChange((email) => {
      if (skipInitialAuthEvent) {
        skipInitialAuthEvent = false;
        return;
      }

      void this.applyAuthenticatedEmail(email, true);
    });

    await Promise.all([
      this.loadProducts(),
      this.loadServices()
    ]);

    if (this.isAdmin) {
      await this.ensureAdminModulesLoaded();
    }
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  setActiveSection(section: ActiveSection): void {
    if (!this.canAccessSection(section)) {
      this.activeSection = 'products';
      return;
    }

    this.activeSection = section;
  }

  startProductEdit(product: Product): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingProduct = product;
  }

  startServiceEdit(service: SalonService): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingService = service;
  }

  startCashMovementEdit(movement: CashMovement): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingCashMovement = movement;
  }

  startInventoryItemEdit(item: InventoryItem): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingInventoryItem = item;
  }

  startInventoryMovementEdit(movement: InventoryMovement): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingInventoryMovement = movement;
  }

  startSupportTicketEdit(ticket: SupportTicket): void {
    if (!this.isAdmin) {
      return;
    }

    this.editingSupportTicket = ticket;
  }

  setCashPreset(preset: CashPeriodPreset): void {
    this.cashPeriodPreset = preset;

    if (preset === 'today') {
      const today = this.getTodayValue();
      this.cashRangeStart = today;
      this.cashRangeEnd = today;
      return;
    }

    if (preset === 'month') {
      this.cashRangeStart = this.getMonthStartValue();
      this.cashRangeEnd = this.getTodayValue();
      return;
    }

    if (!this.cashRangeStart || !this.cashRangeEnd) {
      this.cashRangeStart = this.getMonthStartValue();
      this.cashRangeEnd = this.getTodayValue();
    }
  }

  setInventoryStockFilter(filter: InventoryStockFilter): void {
    this.inventoryStockFilter = filter;
  }

  updateCashRange(boundary: 'start' | 'end', event: Event): void {
    const target = event.target as HTMLInputElement;

    if (boundary === 'start') {
      this.cashRangeStart = target.value || this.getMonthStartValue();
    } else {
      this.cashRangeEnd = target.value || this.getTodayValue();
    }

    this.cashPeriodPreset = 'custom';
  }

  updateInventoryCategoryFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.inventoryCategoryFilter = target.value || 'all';
  }

  updateInventorySearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.inventorySearchTerm = target.value || '';
  }

  toggleTheme(): void {
    const nextTheme = this.themeService.toggleTheme();
    const label = nextTheme === 'dark' ? 'Modo oscuro activado.' : 'Modo claro activado.';
    this.notificationService.info('Tema actualizado', label);
  }

  async sendAdminAccessLink(): Promise<void> {
    if (!this.isAuthReady || this.isSendingAdminAccessLink) {
      return;
    }

    this.isSendingAdminAccessLink = true;

    try {
      this.setQuickAdminFlag(true);
      await this.applyAuthenticatedEmail(this.adminEmail, false);
      this.notificationService.success(
        'Modo administrador activo',
        'Entraste directamente como administrador para pruebas desde este dispositivo.'
      );
    } catch (error) {
      console.error(error);
      this.notificationService.error(
        'No se pudo activar el acceso',
        error instanceof Error ? error.message : 'Ocurrio un error al cambiar al modo administrador.'
      );
    } finally {
      this.isSendingAdminAccessLink = false;
    }
  }

  async signOutAdministrator(): Promise<void> {
    if (!this.currentUserEmail) {
      return;
    }

    try {
      this.setQuickAdminFlag(false);
      await this.supabaseService.signOut();
      await this.applyAuthenticatedEmail(null, false);
      this.notificationService.info('Sesion cerrada', 'Volviste al modo usuario del sistema.');
    } catch (error) {
      console.error(error);
      this.notificationService.error(
        'No se pudo cerrar la sesion',
        error instanceof Error ? error.message : 'Ocurrio un error al cerrar la sesion.'
      );
    }
  }

  async loadProducts(): Promise<void> {
    this.isLoadingProducts = true;
    this.productsErrorMessage = '';

    try {
      this.products = await this.supabaseService.getProducts();
    } catch (error) {
      console.error(error);
      this.productsErrorMessage = error instanceof Error ? error.message : 'Error al cargar los productos.';
      this.notificationService.error('Error de productos', this.productsErrorMessage);
    } finally {
      this.isLoadingProducts = false;
    }
  }

  async loadServices(): Promise<void> {
    this.isLoadingServices = true;
    this.servicesErrorMessage = '';

    try {
      this.services = await this.supabaseService.getServices();
    } catch (error) {
      console.error(error);
      this.servicesErrorMessage = error instanceof Error ? error.message : 'Error al cargar los servicios.';
      this.notificationService.error('Error de servicios', this.servicesErrorMessage);
    } finally {
      this.isLoadingServices = false;
    }
  }

  async loadCashMovements(): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    this.isLoadingCash = true;
    this.cashErrorMessage = '';

    try {
      this.cashMovements = await this.supabaseService.getCashMovements();
    } catch (error) {
      console.error(error);
      this.cashErrorMessage = error instanceof Error ? error.message : 'Error al cargar los movimientos de caja.';
      this.notificationService.error('Error de caja', this.cashErrorMessage);
    } finally {
      this.isLoadingCash = false;
    }
  }

  async loadInventoryData(): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    this.isLoadingInventory = true;
    this.inventoryErrorMessage = '';

    try {
      const [items, movements] = await Promise.all([
        this.supabaseService.getInventoryItems(),
        this.supabaseService.getInventoryMovements()
      ]);

      this.inventoryItems = items;
      this.inventoryMovements = movements;
    } catch (error) {
      console.error(error);
      this.inventoryErrorMessage = error instanceof Error ? error.message : 'Error al cargar el inventario.';
      this.notificationService.error('Error de inventario', this.inventoryErrorMessage);
    } finally {
      this.isLoadingInventory = false;
    }
  }

  async loadSupportTickets(): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    this.isLoadingSupport = true;
    this.supportErrorMessage = '';

    try {
      this.supportTickets = await this.supabaseService.getSupportTickets();
    } catch (error) {
      console.error(error);
      this.supportErrorMessage = error instanceof Error ? error.message : 'Error al cargar los tickets de soporte.';
      this.notificationService.error('Error de soporte', this.supportErrorMessage);
    } finally {
      this.isLoadingSupport = false;
    }
  }

  async deleteProduct(product: Product): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    const shouldDelete = window.confirm(`Deseas eliminar "${product.name}" del catalogo?`);

    if (!shouldDelete) {
      return;
    }

    this.deletingProductId = product.id;

    try {
      await this.supabaseService.deleteProduct(product);
      await this.loadProducts();
      this.notificationService.success('Producto eliminado', `"${product.name}" fue eliminado del catalogo.`);
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo eliminar', 'Ocurrio un error al eliminar el producto.');
    } finally {
      this.deletingProductId = null;
    }
  }

  async deleteService(service: SalonService): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    const shouldDelete = window.confirm(`Deseas eliminar "${service.name}" del listado de servicios?`);

    if (!shouldDelete) {
      return;
    }

    this.deletingServiceId = service.id;

    try {
      await this.supabaseService.deleteService(service.id);
      await this.loadServices();
      this.notificationService.success('Servicio eliminado', `"${service.name}" fue eliminado correctamente.`);
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo eliminar', 'Ocurrio un error al eliminar el servicio.');
    } finally {
      this.deletingServiceId = null;
    }
  }

  async deleteCashMovement(movement: CashMovement): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    const shouldDelete = window.confirm(`Deseas eliminar el movimiento "${movement.concept}"?`);

    if (!shouldDelete) {
      return;
    }

    this.deletingCashMovementId = movement.id;

    try {
      await this.supabaseService.deleteCashMovement(movement.id);
      await this.loadCashMovements();
      this.notificationService.success('Movimiento eliminado', `"${movement.concept}" fue eliminado de caja.`);
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo eliminar', 'Ocurrio un error al eliminar el movimiento de caja.');
    } finally {
      this.deletingCashMovementId = null;
    }
  }

  async deleteInventoryMovement(movement: InventoryMovement): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    const shouldDelete = window.confirm(`Deseas eliminar el movimiento de "${movement.item_name}"?`);

    if (!shouldDelete) {
      return;
    }

    this.deletingInventoryMovementId = movement.id;

    try {
      await this.supabaseService.deleteInventoryMovement(movement.id);
      await this.loadInventoryData();
      this.notificationService.success('Movimiento eliminado', `Se elimino el movimiento de ${movement.item_name}.`);
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo eliminar', 'Ocurrio un error al eliminar el movimiento de inventario.');
    } finally {
      this.deletingInventoryMovementId = null;
    }
  }

  async updateSupportTicketStatus(ticket: SupportTicket): Promise<void> {
    if (!this.isAdmin) {
      return;
    }

    const nextStatus = this.getNextSupportStatus(ticket.status);
    this.updatingSupportTicketId = ticket.id;

    try {
      await this.supabaseService.updateSupportTicketStatus(
        ticket.id,
        nextStatus,
        nextStatus === 'resolved' ? 'Caso revisado y resuelto desde el panel de soporte.' : null
      );
      await this.loadSupportTickets();
      this.notificationService.success('Ticket actualizado', `El caso "${ticket.title}" ahora esta en ${this.getSupportStatusLabel(nextStatus).toLowerCase()}.`);
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo actualizar', 'Ocurrio un error al cambiar el estado del ticket.');
    } finally {
      this.updatingSupportTicketId = null;
    }
  }

  generateCashClosure(): void {
    if (!this.isAdmin) {
      return;
    }

    if (!this.filteredCashMovements.length) {
      this.notificationService.warning('Sin datos para cerrar', 'Registra movimientos en el periodo activo antes de generar el cierre.');
      return;
    }

    this.lastCashClosureGeneratedAt = new Date();
    this.notificationService.success('Cierre generado', 'El reporte detallado de caja fue actualizado con el periodo seleccionado.');
  }

  exportCashCsv(): void {
    if (!this.isAdmin) {
      return;
    }

    if (!this.filteredCashMovements.length) {
      this.notificationService.warning('Nada para exportar', 'No hay movimientos en el rango activo para generar el archivo.');
      return;
    }

    const rows = [
      ['tipo', 'categoria', 'concepto', 'monto', 'fecha_movimiento', 'notas', 'creado_en'],
      ...this.filteredCashMovements.map((movement) => ([
        movement.type === 'income' ? 'Ingreso' : 'Egreso',
        movement.category,
        movement.concept,
        `${Number(movement.amount)}`,
        movement.movement_date,
        movement.notes || '',
        movement.created_at
      ]))
    ];

    const csvContent = `\uFEFF${rows.map((row) => row.map((value) => this.escapeCsvValue(value)).join(',')).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    const { start, end } = this.getNormalizedCashRange();

    link.href = url;
    link.download = `caja-${start}-a-${end}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.notificationService.success('Exportacion lista', 'Se descargo el reporte CSV de la caja del periodo actual.');
  }

  onProductAdded(): void {
    this.editingProduct = null;
    void this.loadProducts();
  }

  onServiceAdded(): void {
    this.editingService = null;
    void this.loadServices();
  }

  onCashMovementAdded(): void {
    this.editingCashMovement = null;
    void this.loadCashMovements();
  }

  onInventoryUpdated(): void {
    this.editingInventoryItem = null;
    this.editingInventoryMovement = null;
    void this.loadInventoryData();
  }

  onSupportTicketCreated(): void {
    this.editingSupportTicket = null;
    void this.loadSupportTickets();
  }

  cancelProductEdit(): void {
    this.editingProduct = null;
  }

  cancelServiceEdit(): void {
    this.editingService = null;
  }

  cancelCashMovementEdit(): void {
    this.editingCashMovement = null;
  }

  cancelInventoryItemEdit(): void {
    this.editingInventoryItem = null;
  }

  cancelInventoryMovementEdit(): void {
    this.editingInventoryMovement = null;
  }

  cancelSupportTicketEdit(): void {
    this.editingSupportTicket = null;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = this.defaultImageUrl;
  }

  trackByProduct(_index: number, product: Product): string {
    return product.id;
  }

  trackByService(_index: number, service: SalonService): string {
    return service.id;
  }

  trackByCashMovement(_index: number, movement: CashMovement): string {
    return movement.id;
  }

  trackByInventoryItem(_index: number, item: InventoryItem): string {
    return item.id;
  }

  trackByInventoryMovement(_index: number, movement: InventoryMovement): string {
    return movement.id;
  }

  trackBySupportTicket(_index: number, ticket: SupportTicket): string {
    return ticket.id;
  }

  formatServiceDuration(totalMinutes: number): string {
    return this.formatDuration(totalMinutes);
  }

  formatCashDate(value: string): string {
    return this.longDateFormatter.format(this.toSafeDate(value));
  }

  formatCashCreatedAt(value: string): string {
    return this.dateTimeFormatter.format(new Date(value));
  }

  formatInventoryQuantity(value: number): string {
    return this.quantityFormatter.format(Number(value) || 0);
  }

  formatInventoryMovementType(type: 'entry' | 'exit'): string {
    return type === 'entry' ? 'Entrada' : 'Salida';
  }

  getSupportStatusLabel(status: SupportTicketStatus): string {
    const labels: Record<SupportTicketStatus, string> = {
      open: 'Abierto',
      in_progress: 'En progreso',
      resolved: 'Resuelto'
    };

    return labels[status];
  }

  getSupportPriorityLabel(priority: SupportTicketPriority): string {
    const labels: Record<SupportTicketPriority, string> = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta'
    };

    return labels[priority];
  }

  getSupportModuleLabel(module: SupportModuleArea): string {
    const labels: Record<SupportModuleArea, string> = {
      general: 'General',
      products: 'Productos',
      services: 'Servicios',
      cash: 'Caja',
      inventory: 'Inventario',
      support: 'Soporte'
    };

    return labels[module];
  }

  getSupportTicketActionLabel(ticket: SupportTicket): string {
    if (ticket.status === 'open') {
      return 'Tomar caso';
    }

    if (ticket.status === 'in_progress') {
      return 'Marcar resuelto';
    }

    return 'Reabrir';
  }

  getSupportStatusClass(status: SupportTicketStatus): string {
    return `support-ticket-card__status--${status}`;
  }

  getSupportPriorityClass(priority: SupportTicketPriority): string {
    return `support-ticket-card__priority--${priority}`;
  }

  getTrendWidth(value: number, maxValue: number): number {
    if (maxValue <= 0) {
      return 0;
    }

    return Math.max(8, (value / maxValue) * 100);
  }

  getInventoryStatusLabel(item: InventoryItem): string {
    if (this.isCriticalStock(item)) {
      return 'Critico';
    }

    if (this.isLowStock(item)) {
      return 'Bajo minimo';
    }

    return 'Disponible';
  }

  getInventoryStatusClass(item: InventoryItem): string {
    if (this.isCriticalStock(item)) {
      return 'inventory-item-card__status--critical';
    }

    if (this.isLowStock(item)) {
      return 'inventory-item-card__status--warning';
    }

    return 'inventory-item-card__status--good';
  }

  private async restoreAccessState(): Promise<void> {
    try {
      if (this.getQuickAdminFlag()) {
        await this.applyAuthenticatedEmail(this.adminEmail, false);
        return;
      }

      const email = await this.supabaseService.getAuthenticatedEmail();
      await this.applyAuthenticatedEmail(email, false);
    } catch (error) {
      console.error(error);
      this.isAuthReady = true;
      this.notificationService.warning(
        'Acceso no verificado',
        'No fue posible revisar la sesion del administrador. La app seguira en modo usuario.'
      );
    }
  }

  private async applyAuthenticatedEmail(email: string | null, shouldNotify: boolean): Promise<void> {
    const normalizedEmail = email?.toLowerCase() || null;
    const previousEmail = this.currentUserEmail;
    const hadAdminAccess = this.isAdmin;

    this.currentUserEmail = normalizedEmail;
    this.isAdmin = this.supabaseService.isAdminEmail(normalizedEmail);
    this.isAuthReady = true;

    if (this.isAdmin) {
      await this.ensureAdminModulesLoaded();

      if (shouldNotify && normalizedEmail && normalizedEmail !== previousEmail) {
        this.notificationService.success(
          'Administrador autenticado',
          'Ya tienes acceso completo a todos los modulos del sistema.'
        );
      }

      return;
    }

    this.resetAdminState();

    if (!this.canAccessSection(this.activeSection)) {
      this.activeSection = 'products';
    }

    if (shouldNotify && !normalizedEmail && hadAdminAccess) {
      this.notificationService.info('Sesion cerrada', 'Volviste al modo usuario del sistema.');
    }

    if (shouldNotify && normalizedEmail && normalizedEmail !== previousEmail) {
      this.notificationService.warning(
        'Acceso limitado',
        'La cuenta iniciada no tiene permisos de administrador y solo vera productos y servicios.'
      );
    }
  }

  private async ensureAdminModulesLoaded(force = false): Promise<void> {
    if (!this.isAdmin || (this.hasLoadedAdminModules && !force)) {
      return;
    }

    await Promise.all([
      this.loadCashMovements(),
      this.loadInventoryData(),
      this.loadSupportTickets()
    ]);

    this.hasLoadedAdminModules = true;
  }

  private resetAdminState(): void {
    this.hasLoadedAdminModules = false;
    this.cashMovements = [];
    this.inventoryItems = [];
    this.inventoryMovements = [];
    this.supportTickets = [];
    this.cashErrorMessage = '';
    this.inventoryErrorMessage = '';
    this.supportErrorMessage = '';
  }

  private canAccessSection(section: ActiveSection): boolean {
    return this.isAdmin || section === 'products' || section === 'services';
  }

  private getQuickAdminFlag(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(this.quickAdminStorageKey) === 'true';
  }

  private setQuickAdminFlag(enabled: boolean): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (enabled) {
      window.localStorage.setItem(this.quickAdminStorageKey, 'true');
      return;
    }

    window.localStorage.removeItem(this.quickAdminStorageKey);
  }

  private isLowStock(item: InventoryItem): boolean {
    return Number(item.current_stock) <= Number(item.min_stock);
  }

  private isCriticalStock(item: InventoryItem): boolean {
    return Number(item.current_stock) <= 0 || Number(item.current_stock) <= Number(item.min_stock) * 0.5;
  }

  private getLargestCashMovement(type: 'income' | 'expense'): CashMovement | null {
    return this.filteredCashMovements
      .filter((movement) => movement.type === type)
      .sort((left, right) => Number(right.amount) - Number(left.amount))[0] || null;
  }

  private getNextSupportStatus(status: SupportTicketStatus): SupportTicketStatus {
    if (status === 'open') {
      return 'in_progress';
    }

    if (status === 'in_progress') {
      return 'resolved';
    }

    return 'open';
  }

  private getNormalizedCashRange(): { start: string; end: string } {
    const today = this.getTodayValue();
    const monthStart = this.getMonthStartValue();

    if (this.cashPeriodPreset === 'today') {
      return { start: today, end: today };
    }

    if (this.cashPeriodPreset === 'month') {
      return { start: monthStart, end: today };
    }

    const start = this.cashRangeStart || monthStart;
    const end = this.cashRangeEnd || today;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatter.format(value || 0);
  }

  private formatQuantity(value: number): string {
    return this.quantityFormatter.format(Number(value) || 0);
  }

  private escapeCsvValue(value: string): string {
    const safeValue = `${value ?? ''}`.replace(/"/g, '""');
    return `"${safeValue}"`;
  }

  private getTodayValue(): string {
    return this.toDateInputValue(new Date());
  }

  private getMonthStartValue(): string {
    const date = new Date();
    date.setDate(1);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const adjustedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjustedDate.toISOString().slice(0, 10);
  }

  private toSafeDate(value: string): Date {
    return new Date(`${value}T12:00:00`);
  }

  private formatDuration(totalMinutes: number): string {
    const safeMinutes = Math.max(0, Number(totalMinutes) || 0);
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
    }

    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
    }

    return parts.join(' ');
  }
}
