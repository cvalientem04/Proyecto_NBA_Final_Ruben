# 1. Portada (Instrucciones)
*En la primera página (sin numerar), debes incluir:*
- **Título del proyecto:** Aplicación Web de Gestión de Estadísticas y Minijuegos de la NBA
- **Nombre completo:** Carlos Valiente Marin
- **Centro educativo:** IES Ágora
- **Tutor/a:** (Añade el nombre de tu tutor/a)
- **Ciclo formativo:** Desarrollo de Aplicaciones Web (DAW)
- **Curso:** 2023/2024 (o el correspondiente)

*(Inserta un salto de página después de la portada)*

---

# 2. Índice
*(Genera un índice automático en Word con estas secciones)*
1. Introducción
2. Desarrollo del proyecto
3. Dificultades encontradas y posibles soluciones
4. Posibles mejoras
5. Resultados
6. Conclusión
7. Anexos
   7.1. Manual Técnico
   7.2. Manual de Usuario
   7.3. Snippets de Código Destacados

*(Inserta un salto de página después del índice)*

---

# 3. Introducción

## 3.1. Breve descripción del proyecto
El presente proyecto consiste en el diseño, desarrollo e implementación de una aplicación web integral centrada en la NBA. Esta plataforma no solo permite a los usuarios consultar clasificaciones, estadísticas y noticias sobre la liga de baloncesto más importante del mundo, sino que también ofrece un sistema de autenticación de usuarios, gestión de equipos favoritos, comunidad, y un apartado interactivo de minijuegos. El sistema se ha estructurado utilizando una arquitectura cliente-servidor y ha sido completamente contenedorizado mediante Docker para facilitar su despliegue en cualquier entorno.

## 3.2. Justificación
La motivación principal para elegir este proyecto nace de mi fuerte interés tanto por el baloncesto, en particular la NBA, como por el desarrollo web Full-Stack. Aprender a integrar interfaces dinámicas en el frontend con una API robusta en el backend es fundamental en el ciclo de Desarrollo de Aplicaciones Web. Este proyecto me ha permitido aplicar los conocimientos adquiridos durante el ciclo (HTML, CSS, JavaScript modular, Node.js, bases de datos relacionales PostgreSQL y Docker), enfrentando problemas reales similares a los del entorno laboral actual.

## 3.3. Áreas de trabajo
El proyecto abarca varias áreas de la informática y comunicaciones:
- **Desarrollo Frontend:** Interfaz de usuario (UI), experiencia de usuario (UX), consumo de APIs usando fetch, y modularización de JavaScript.
- **Desarrollo Backend:** Creación de una API RESTful en Node.js usando Express, autenticación basada en JWT, encriptación de contraseñas con bcrypt, y prevención de ataques (rate limits, CORS).
- **Gestión de Bases de Datos:** Diseño e implementación del esquema relacional (PostgreSQL) para gestionar usuarios, favoritos y resultados.
- **Sistemas y Despliegue:** Contenedorización de todos los servicios (Nginx, Node e hipotéticamente la base de datos) empleando Docker y Docker Compose.

---

# 4. Desarrollo del proyecto

## 4.1. Arquitectura y Tecnologías
La arquitectura del proyecto está dividida en dos componentes principales gestionados a través de contenedores:
1. **Frontend (Nginx):** Los archivos estáticos (HTML, CSS, JS) son servidos por un servidor web Nginx configurado mediante Docker. La aplicación es del tipo *Single Page Application* o *Multi Page Application* donde JavaScript (`auth.js`, `estadisticas.js`, `favoritos.js`) se encarga de la interactividad.
2. **Backend (Node.js/Express):** Una API construida en Node.js, que se expone en el puerto 3000. Utiliza librerías esenciales como `express` para rutas, `pg` para la interacción con PostgreSQL, `jsonwebtoken` para el control de sesiones, y `bcrypt` para la seguridad de credenciales.

## 4.2. Explicación técnica y partes relevantes
- **Autenticación (JWT):** Uno de los pilares del proyecto es el sistema de usuarios. Al registrarse en `signup.html`, los datos son validados y enviados a la API, que hace hash de la contraseña y crea una entrada en PostgreSQL. En el login, en caso de éxito, el servidor devuelve un Token JWT. El archivo `js/auth.js` se encarga de almacenar este token y adjuntarlo en las cabeceras `Authorization` en futuras peticiones.
- **Consumo de APIs externas e internas:** Archivos como `clasificacion.js` y `stats.js` combinan llamadas a endpoints locales para obtener favoritos y llamadas a APIs de baloncesto (por medio del backend o directas) para poblar dinámicamente el DOM.
- **Minijuegos interactivos:** Se desarrolló una lógica en `minijuegos.js` que no solo entretiene al usuario, sino que integra interacción con el canvas o el DOM y envía las puntuaciones al servidor.

---

# 5. Dificultades encontradas y posibles soluciones

Durante el desarrollo de esta aplicación, surgieron diversos desafíos tanto a nivel metodológico como técnico:

## 5.1. Comunicación asíncrona y CORS
Inicialmente existían problemas de bloqueo por CORS (Cross-Origin Resource Sharing) cuando el frontend (puerto 8080) intentaba enviar peticiones al backend (puerto 3000). 
- **Solución adoptada:** Se configuró el middleware `cors` en Express, limitando el acceso estrictamente a los orígenes conocidos. Se consideró utilizar un proxy inverso en Nginx para unificar los dominios, pero finalmente la separación estricta mediante CORS fue suficiente y más ágil.

## 5.2. Gestión del estado de sesión
Mantener a un usuario logueado entre distintas páginas HTML era complicado usando variables globales.
- **Solución adoptada:** Se optó por usar LocalStorage/SessionStorage en combinación con JSON Web Tokens (JWT). El token se guarda de manera persistente o semi-persistente. Se descartó usar Cookies HTTP-Only por el tiempo que suponía reconfigurar todo el flujo cliente-servidor desde cero, dada la limitación de la fecha de entrega, pero queda registrado como una opción más robusta técnicamente.

## 5.3. Contenedorización
Alinear los volúmenes en `docker-compose.yml` para los archivos del frontend sirviéndolos a través del contenedor `nginx:alpine` generó confusión en las rutas absolutas y relativas dentro del navegador. 
- **Solución adoptada:** Se procedió a utilizar rutas relativas estandarizadas en todo el código HTML/JS, y mapear la raíz de la carpeta del proyecto a `/usr/share/nginx/html`.

---

# 6. Posibles mejoras

- **Migración a un Framework Frontend:** Migrar el Vanilla JavaScript a un framework moderno como React, Angular o Vue.js, lo cual facilitaría significativamente la gestión del estado en componentes interactivos y la carga eficiente de las vistas de clasificaciones y estadísticas.
- **Seguridad en Cookies:** Transicionar el guardado del JWT en LocalStorage a Cookies "HttpOnly", incrementando enormemente la seguridad contra ataques Cross-Site Scripting (XSS).
- **Módulo de Roles y Administrador:** Añadir roles en la Base de Datos para que usuarios con rol "admin" puedan moderar reseñas (`reviews.html`), agregar noticias o administrar a la comunidad en `home-community.js`.
- **Integración Continua (CI/CD):** Implementar GitHub Actions para levantar contenedores de prueba automáticamente ante cada nuevo Commit.

---

# 7. Resultados

El resultado final es una aplicación funcional altamente robusta, empaquetada e independiente gracias a Docker. Los objetivos iniciales se han logrado satisfactoriamente:
- Interfaz reactiva en la que el usuario puede buscar, ordenar y filtrar los resultados de la liga sin cuellos de botella notables.
- Base de datos conectada eficientemente con el servidor en Node, respetando los principios REST y el patrón MVC en la lógica interna.
- Un módulo extra de entretenimiento (minijuegos) perfectamente integrado que interactúa con la sesión del usuario.
La aplicación está lista para ser desplegada en VPS o servicios en la nube (como AWS o Render) ejecutando un simple `docker-compose up -d`.

---

# 8. Conclusión

El proceso completo de desarrollo me ha aportado una visión madura y global que demanda un ciclo de vida del software completo: desde la conceptualización de los esquemas relacionales hasta el despliegue del entorno con contenedores, pasando por el diseño de la UI y la programación del backend. 

A lo largo del proyecto, no obstante, también se han identificado debilidades. La experiencia ha servido para asentar los conocimientos teóricos adquiridos durante los dos años del ciclo IES Ágora, probando que soy capaz de integrarlos en un servicio Full-Stack real y operativo. Las propuestas de mejoras, como implementar CI/CD y mayor seguridad en el manejo de sesiones (Cookies), marcan mis próximos pasos formativos en el área de Informática y Comunicaciones.

---

# 9. Anexos

*(Este apartado debe empezar en una página nueva. Añade capturas de pantalla de la aplicación aquí)*

## 9.1 Manual Técnico (Pasos de instalación)
El proyecto ha sido diseñado para un despliegue ágil.

**Requisitos Previos:**
- Tener instalado **Docker** y **Docker Compose**.
- Tener puertos `8080` y `3000` libres en la máquina host.

**Pasos para el despliegue:**
1. Clonar o descargar el repositorio del código fuente.
2. Acceder al directorio raíz `nba/`.
3. Renombrar el archivo `.env.example` (si existe) dentro de `nba-server` a `.env` y configurar las credenciales de la Base de Datos PostgreSQL.
4. Ejecutar el siguiente comando en terminal:
   `docker-compose up -d --build`
5. El sistema descargará la imagen `nginx:alpine`, creará la imagen del backend basado en `nba-server/Dockerfile` y levantará ambos servicios.
6. El backend de Node.js escuchará en `http://localhost:3000`.
7. El frontend será accesible desde `http://localhost:8080`.

## 9.2 Manual de Usuario
El diseño es intuitivo. 
1. **Acceso y Registro:** Al entrar, el usuario puede ver la portada. Ciertas funciones, como guardar un equipo en favoritos o participar en la comunidad de reseñas, exigen tener una cuenta. Los usuarios pueden registrarse en el botón superior de registro (`signup.html`) e introducir sus credenciales.
2. **Navegación:** Un menú principal facilita el salto hacia `stats.html`, `standings.html` o `news.html`.
3. **Sección Interactiva:** En `minigames.html`, los jugadores logueados pueden jugar para conseguir la mejor puntuación, la cual puede quedar registrada temporalmente en los parámetros del navegador o base de datos.
4. **Cierre de sesión:** Pulsar salir destruye la sesión segura local y requiere que el usuario haga login nuevamente en `login.html`.

## 9.3 Información de despliegue y Máquinas Virtuales
*NOTA: Según se requiere en la descripción oficial: "Si se utilizan máquinas virtuales, hay que entregar las ovas de cada una de ellas." En este proyecto no se utilizan máquinas virtuales directamente (OVAs de VirtualBox o VMware), sino contenedores Docker. Se recomienda matizar esto al tribunal.*
