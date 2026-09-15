# Sugestión • Sistema Digital de Control de Stock y Materia Prima

Sistema de relevamiento de stock físico de materias primas y packaging con cálculo dinámico mensual de mínimos y máximos estacionales, órdenes de compra automáticas y portal optimizado para tablets en depósito.

---

## 🚀 Cómo ejecutarlo en tu computadora (Local)

Si clonaste este repositorio desde GitHub en tu computadora:

1. **Abrir la terminal** en la carpeta del proyecto.
2. **Instalar dependencias**:
   ```bash
   npm install
   ```
3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
4. **Abrir en tu navegador**:
   - Acceso Administrador: [http://localhost:3000](http://localhost:3000)
   - Acceso Operador (Tablet): [http://localhost:3000#operador](http://localhost:3000#operador)

---

## 🌐 Cómo publicarlo gratis en internet (Para acceder desde cualquier celular o tablet)

GitHub por defecto almacena el código fuente, no ejecuta aplicaciones web directamente a menos que configures un despliegue:

### Opción 1: Vercel (Recomendada - 1 minuto y gratis)
1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"Add New Project"** e importa este repositorio.
3. Deja la configuración por defecto y haz clic en **"Deploy"**.
4. ¡Listo! Vercel te dará un enlace público HTTPS (ej: `https://tu-proyecto.vercel.app`) para usar en cualquier tablet o PC.

### Opción 2: GitHub Pages (Directo desde GitHub)
1. En tu repositorio de GitHub, ve a **Settings** > **Pages** (en el menú lateral izquierdo).
2. En **Build and deployment** > **Source**, selecciona **"GitHub Actions"**.
3. El archivo `.github/workflows/deploy.yml` ya incluido compilará y publicará la aplicación automáticamente.

---

## 📱 Accesos y Roles
- **Portal Operador (Tablet)**: Permite registrar el stock mensual por bultos o por unidades directas. La interfaz está bloqueada para evitar modificaciones en compras o fórmulas.
  - URL directa: `tu-enlace/#operador`
- **Portal Administrador**: Muestra el tablero de control, estado crítico, cálculo de reposición en unidades y ajustes de factores estacionales.
  - PIN por defecto: `1234`
