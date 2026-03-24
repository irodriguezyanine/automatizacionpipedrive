# Agentes recomendados para TasacionesVedisa

Proyecto: [TasacionesVedisa](https://github.com/irodriguezyanine/TasacionesVedisa) — sistema de tasaciones de vehículos siniestrados con React, TypeScript, Vite, Supabase, generación de PDF y Edge Functions.

---

## Agentes que te convienen (y por qué)

| Agente | Por qué te sirve en TasacionesVedisa |
|--------|--------------------------------------|
| **react-specialist** | La app es React 18: formularios (Nueva Tasación), tablas con filtros, `@react-pdf/renderer`, virtualización (`@tanstack/react-virtual`). Este agente ayuda a mantener patrones modernos, hooks y componentes sin romper lo existente. |
| **typescript-pro** | Todo el front y los scripts están en TypeScript; usas Zod para validación. Sirve para tipos, refactors y consistencia en `src/` y `scripts/`. |
| **fullstack-developer** | Cada funcionalidad cruza front (formulario/tabla) + Supabase (tablas, RLS, Storage) + a veces Edge Functions o PDF. Ideal para tareas del tipo “agregar campo X a la tasación y que se guarde y salga en el PDF”. |
| **code-reviewer** | Antes de mergear: estilo, posibles bugs, buenas prácticas. Útil para mantener calidad con varios colaboradores o cuando tocas RLS y Edge Functions. |
| **documentation-engineer** | README, `DEPLOY-SIMPLEFACTURA.md`, `MEJORAS.md`, comentarios en código y documentación de Edge Functions. Mantiene el repo ordenado para quien entre después. |

### Opcionales (según necesidad)

| Agente | Cuándo usarlo |
|--------|----------------|
| **qa-expert** | Si quieres ampliar cobertura con Vitest/Testing Library o definir casos de prueba para flujos críticos (login, crear tasación, PDF). |
| **security-auditor** | Si quieres revisar Auth, roles, RLS, políticas de Storage y uso de secrets en Edge Functions. |

---

## Cómo integrarlos

Los agentes son **definiciones para Claude Code** (archivos que Claude usa para invocar subagentes). No “se integran” dentro del código de TasacionesVedisa; los usas **desde Claude Code** cuando trabajas en el repo.

### Opción A: Plugin por categoría (recomendada)

En **Claude Code** (o el cliente que uses con este catálogo):

```bash
# Añadir el marketplace (una vez)
claude plugin marketplace add VoltAgent/awesome-claude-code-subagents

# Instalar los plugins que contienen los agentes que quieres
claude plugin install voltagent-core-dev    # fullstack-developer, frontend-developer, etc.
claude plugin install voltagent-lang       # typescript-pro, react-specialist no está aquí — está en core-dev
```

En el repo de VoltAgent, **react-specialist** está en **Language Specialists** (`voltagent-lang`) y **fullstack-developer** en **Core Development** (`voltagent-core-dev`). Instalando ambos plugins tendrás:

- `voltagent-core-dev` → fullstack-developer, frontend-developer, api-designer, backend-developer, etc.
- `voltagent-lang` → typescript-pro, react-specialist, nextjs-developer, etc.

Para **code-reviewer** y **documentation-engineer**:

```bash
claude plugin install voltagent-qa-sec     # code-reviewer, qa-expert, etc.
claude plugin install voltagent-dev-exp    # documentation-engineer, etc.
```

Así quedan disponibles en Claude Code y podrás pedir, por ejemplo:  
*“Usa el fullstack-developer para agregar el campo X a la tasación y que se guarde en Supabase y aparezca en el PDF”* o *“Que el code-reviewer revise mis últimos cambios”*.

### Opción B: Solo en el proyecto TasacionesVedisa (agentes por repo)

Si quieres que **solo** en TasacionesVedisa Claude tenga estos agentes (sin instalar plugins globales):

1. Clona el catálogo de agentes:
   ```bash
   git clone https://github.com/VoltAgent/awesome-claude-code-subagents.git
   ```

2. Copia solo los `.md` que te interesan a la carpeta de agentes **del proyecto**:
   ```bash
   cd TasacionesVedisa
   mkdir -p .claude/agents
   cp ../awesome-claude-code-subagents/categories/01-core-development/fullstack-developer.md .claude/agents/
   cp ../awesome-claude-code-subagents/categories/02-language-specialists/react-specialist.md .claude/agents/
   cp ../awesome-claude-code-subagents/categories/02-language-specialists/typescript-pro.md .claude/agents/
   cp ../awesome-claude-code-subagents/categories/04-quality-security/code-reviewer.md .claude/agents/
   cp ../awesome-claude-code-subagents/categories/06-developer-experience/documentation-engineer.md .claude/agents/
   ```

3. Añade `.claude/` al `.gitignore` si no quieres versionar los agentes, o déjalos versionados para que todo el equipo use los mismos.

En Claude Code, al abrir TasacionesVedisa, esos agentes estarán disponibles (los de `.claude/agents/` tienen prioridad sobre los globales).

### Opción C: Instalador interactivo del repo

Desde tu máquina:

```bash
curl -sO https://raw.githubusercontent.com/VoltAgent/awesome-claude-code-subagents/main/install-agents.sh
chmod +x install-agents.sh
./install-agents.sh
```

El script te deja elegir categorías o agentes y si instalarlos en `~/.claude/agents/` (global) o en un proyecto. Elige los que listamos arriba.

---

## Resumen

- **Para desarrollo diario en TasacionesVedisa:** **react-specialist**, **typescript-pro**, **fullstack-developer**.
- **Para calidad y documentación:** **code-reviewer**, **documentation-engineer**.
- **Integración:** no va “dentro” del código de TasacionesVedisa; son agentes de Claude Code que usas al trabajar en el repo. La forma más simple es instalar los plugins `voltagent-core-dev` y `voltagent-lang` (y si quieres `voltagent-qa-sec` y `voltagent-dev-exp`) desde el marketplace de Claude Code.

Repo de agentes: [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents).
