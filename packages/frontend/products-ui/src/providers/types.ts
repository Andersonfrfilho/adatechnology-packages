export interface ProductsApi {
  listProducts(params?: {
    page?: number
    search?: string
    catalogId?: string
    active?: boolean
  }): Promise<PaginatedResponse<Product>>
  getProduct(id: string): Promise<Product>
  createProduct(data: CreateProductInput): Promise<Product>
  updateProduct(id: string, data: UpdateProductInput): Promise<Product>
  deleteProduct(id: string): Promise<void>

  listCatalogs(params?: { page?: number; search?: string }): Promise<PaginatedResponse<Catalog>>
  getCatalog(id: string): Promise<Catalog>
  createCatalog(data: CreateCatalogInput): Promise<Catalog>
  updateCatalog(id: string, data: UpdateCatalogInput): Promise<Catalog>
  deleteCatalog(id: string): Promise<void>

  uploadImage(file: File): Promise<{ url: string; key: string }>
  bulkImportProducts(file: File): Promise<BulkImportResult>
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: string
  costPrice: string | null
  unit: string
  barcode: string | null
  imageUrl: string | null
  catalogId: string | null
  catalogName?: string
  sectionId: string | null
  sectionName?: string
  active: boolean
  sortOrder: number
  inventory: number
  availability: string
  preparationTimeMinutes: number | null
}

export interface Catalog {
  id: string
  name: string
  description: string | null
  active: boolean
  productCount?: number
}

export interface Section {
  id: string
  name: string
  catalogId: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateProductInput {
  name: string
  description?: string
  price: number
  costPrice?: number
  unit?: string
  barcode?: string
  catalogId?: string
  sectionId?: string
  imageUrl?: string
  inventory?: number
  preparationTimeMinutes?: number
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  active?: boolean
  sortOrder?: number
}

export interface CreateCatalogInput {
  name: string
  description?: string
}

export interface UpdateCatalogInput extends Partial<CreateCatalogInput> {
  active?: boolean
}

export interface BulkImportResult {
  succeeded: number
  failed: number
  errors: Array<{ row: number; message: string }>
}
