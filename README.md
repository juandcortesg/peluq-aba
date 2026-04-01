# peluq-ABA

Aplicacion profesional para registrar productos de peluqueria con Angular 17, formularios reactivos y Supabase.

## Lo que ya hace

- Crear productos con `nombre` y `precio` obligatorios.
- Permitir `descripcion` e `imagen` opcionales.
- Mostrar una imagen suplementaria local cuando el producto no tiene foto.
- Listar productos guardados en Supabase.
- Eliminar productos y, si aplica, su imagen en Supabase Storage.
- Quedar lista para despliegue automatico en GitHub Pages.

## Tecnologias

- Angular 17
- Reactive Forms
- Supabase Database + Storage
- GitHub Actions para GitHub Pages
- SCSS con interfaz premium para `peluq-ABA`

## Ejecutar en local

```bash
npm install
npm start
```

La app queda disponible en `http://localhost:4200/`.

## Configuracion de Supabase

Los datos de conexion estan en:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

La app espera:

- Tabla `products`
- Bucket publico `product-images`

Puedes crear la estructura base con el archivo `supabase/schema.sql`.

## Despliegue en GitHub Pages

Ya quedo preparado el workflow:

- `.github/workflows/deploy.yml`

Cuando subas el proyecto a GitHub:

1. Crea el repositorio.
2. Sube la rama `main`.
3. En GitHub activa `Settings > Pages > Build and deployment > GitHub Actions`.
4. El workflow publicara automaticamente la app.

Importante:

- El workflow usa `--base-href /peluq-aba/`.
- Si tu repositorio tiene otro nombre, cambia ese valor en `.github/workflows/deploy.yml`.

## Estructura importante

- `src/app/features/products/components/product-form/`: formulario reactivo.
- `src/app/features/products/components/product-list/`: vista principal y catalogo.
- `src/app/core/services/supabase.service.ts`: integracion con Supabase.
- `src/assets/images/product-placeholder.svg`: imagen por defecto.

## Build de produccion

```bash
npm run build
```

El resultado queda en `dist/peluq-aba/`.
