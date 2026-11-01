# Sprint Inercial

## Desarrollo local

La integración de Groq usa variables de entorno únicamente en la función
serverless de Netlify. Copia `.env.example` como `.env` y completa:

```env
GROQ_API_KEY=gsk_tu_clave_real
GROQ_MODEL=llama-3.1-8b-instant
```

Inicia la aplicación con Netlify CLI para que la función pueda leer esas
variables:

```bash
npx netlify dev
```

La interfaz llama a `/.netlify/functions/generate-suggestions`. No uses
`VITE_GROQ_API_KEY`: las variables `VITE_*` se incluirían en el bundle del
frontend y expondrían el secreto.