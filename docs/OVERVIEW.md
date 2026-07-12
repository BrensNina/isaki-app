# isaki-app — Overview funcional

Sistema de gestión de pedidos mayoristas **B2B** para ISAKI.PERU / MAYTA SPORT.
App web (Next.js 16 App Router) desplegada en **Cloudflare Workers** vía OpenNext.
Datos y autenticación con **Firebase** (Firestore + Auth, SDK Web solo en el
cliente). Adjuntos en **Cloudflare R2** y notificaciones por **Telegram**.

> Prototipo funcional. Las reglas de seguridad están revisadas pero no
> endurecidas para producción (ver sección **Seguridad**).

---

## Roles

| Rol | Puede hacer |
|-----|-------------|
| **Administrador** | Todo. Ve y gestiona todos los clientes, pedidos y cotizaciones; conduce el pedido por cualquier estado; gestiona usuarios. |
| **Vendedor** | Gestiona **solo lo suyo** (clientes, pedidos y cotizaciones que registró). Crea pedidos, solicita cotización, aprueba a producción. |
| **Producción** | Ve todos los pedidos y avanza los estados de fabricación (iniciar producción → control de calidad → listo para entrega), reporta avances. |
| **Cliente mayorista** | No usa la app. Es un registro comercial del vendedor; recibe avisos por Telegram si se vincula (opt-in). |

Al registrarse, una cuenta nueva queda como **vendedor** por defecto; el rol lo
ajusta un administrador. Un no-admin no puede cambiarse el rol a sí mismo
(bloqueado por reglas de Firestore).

---

## Módulos

### 1. Clientes
- Alta/edición/baja de clientes mayoristas (persona natural o jurídica, DNI/RUC,
  contacto, dirección principal de envío embebida).
- El vendedor ve solo sus clientes; el admin los ve **agrupados por vendedor**
  ("Cartera de: …").
- Botón ✈️ para **vincular Telegram**: copia el enlace `t.me/<bot>?start=<clienteId>`
  que el cliente abre y da *Start* para recibir avisos.

### 2. Pedidos
- Cabecera + líneas embebidas (producto, talla, color, cantidad, precio unitario).
  Totales, anticipo y saldo se recalculan al guardar.
- **Adjuntos** (Cloudflare R2): subir/descargar/eliminar documentos e imágenes por
  pedido (tope 15 MB). Se pueden adjuntar **al crear** el pedido (se suben tras
  registrarlo) o después desde el detalle. Metadatos en el propio documento.
- **Seguimiento / trazabilidad**: cada cambio de estado deja una entrada en el
  historial con fecha y nota (línea de tiempo en el detalle).
- Filtros por estado con conteo.

**Flujo de estados**

```
registrado ──► esperando_cotizacion ──► cotizado ──► pendiente_produccion
     │                                       │              │
     └────────── (aprobar directo) ──────────┘              ▼
                                                       en_produccion
                                                            │
                                                            ▼
                                                     control_calidad
                                                            │
                                                            ▼
                                                     listo_entrega ──► entregado

(cualquier estado no final ──► cancelado)
```

- **registrado**: el vendedor/admin puede *solicitar cotización a admin* o
  *aprobar directo a producción* (confirma anticipo → cola de producción).
- **esperando_cotizacion** → admin *envía cotización* → **cotizado**.
- **cotizado**: vendedor/admin *aprueba y confirma anticipo* → cola de producción.
- **pendiente_produccion** en adelante: rol Producción (o admin) avanza los pasos.
- **listo_entrega**: admin *marca como entregado*.

### 3. Cotizaciones
- Propuesta de precio previa al pedido (borrador → enviada → aprobada/rechazada).
- Al **aprobar**, se **convierte en un pedido real** (reutiliza la creación de
  pedidos) y quedan enlazados por `pedidoGeneradoId`.
- **Generar PDF**: desde el detalle se descarga un PDF real de la cotización
  (generado con jsPDF en el navegador) para enviárselo al cliente.
- Cada cotización lleva fecha de emisión y condiciones/notas comerciales.
- Gestión comercial: admin (todas) y vendedor (solo las suyas).

### 4. Notificaciones a clientes (Telegram, opt-in)
- El cliente se vincula abriendo el enlace y dando *Start*; el webhook guarda su
  chat en KV (`cliente:<id>`).
- El sistema le avisa automáticamente en los hitos relevantes: pedido registrado,
  en producción, control de calidad, listo para entrega, entregado, cancelado, y
  reportes de avance. Los pasos internos (cotización, cola) no molestan al cliente.
- Cada mensaje incluye la **referencia del pedido** (`#XXXXXX`) para que el cliente
  distinga entre pedidos distintos.
- Todo es **best-effort**: si el cliente no vinculó o el bot no está configurado,
  la operación principal no se ve afectada.

---

## Arquitectura (resumen)

- **Frontend**: React/Next 16, Tailwind v4. Firebase se carga **solo en el
  cliente** (`app-shell` vía `next/dynamic ssr:false`) — nunca en SSR (el runtime
  de Workers prohíbe `new Function`).
- **Capa de datos** (`src/lib/*.ts`): `clientes`, `pedidos`, `cotizaciones`,
  `adjuntos`, `notify`. Encapsulan Firestore y la lógica de negocio.
- **Route handlers** (`src/app/api/*`), lado servidor/Worker, sin Firebase:
  - `/api/adjuntos` (+ `/[...key]`): subida/descarga/borrado en R2.
  - `/api/telegram`: envío saliente a un cliente (resuelve su chat desde KV).
  - `/api/telegram/webhook`: entrada de Telegram, valida secreto, vincula clientes.
- **Bindings Cloudflare** (`wrangler.jsonc`): R2 `ADJUNTOS_BUCKET`, KV `TELEGRAM_KV`.
  Secretos del Worker: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
- **CI/CD**: Cloudflare **Workers Builds** despliega en cada push a `master`.

---

## Seguridad (estado de prototipo)

- Reglas de Firestore por rol y propiedad (`vendedorUid`); *default-deny* para el
  resto. El rol se lee del perfil del usuario.
- **Pendiente de endurecer**:
  - Los endpoints de adjuntos (`/api/adjuntos`) **no autentican**: cualquiera con
    la URL puede subir/leer/borrar. Verificar el ID token de Firebase si importa.
  - El rol Producción puede actualizar cualquier campo de un pedido (no hay
    validación a nivel de campo).
  - Auto-registro habilitado (queda como vendedor); no hay aprobación previa.

---

## Limitaciones conocidas

- No hay módulo de Entregas/logística ni reportes/exportación.
- El cliente mayorista no tiene acceso propio a la app (solo avisos por Telegram).
- Sin runner de tests configurado; verificación vía `npm run preview` (workerd).
