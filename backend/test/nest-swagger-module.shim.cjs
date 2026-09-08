/**
 * Jest-only CJS stand-in for @nestjs/swagger/dist/swagger-module.js.
 *
 * That file does `const require = createRequire(import.meta.url);` at module
 * scope (an ESM-only pattern the CJS Jest runtime can't even parse) purely to
 * lazy-load swagger-ui assets for serving live API docs. It's only reached in
 * this codebase from app bootstrap (`main.ts`'s `SwaggerModule.setup(...)`),
 * never from any service/controller under test — confirmed by grepping the repo
 * for SwaggerModule/DocumentBuilder usage outside main.ts. It's only loaded here
 * at all because @nestjs/swagger's barrel re-exports it alongside the decorators
 * (@ApiProperty etc.) that DTOs actually need, so this stub exists to satisfy that
 * import, not to reproduce its behavior — it throws if actually invoked, so a
 * wrong assumption here fails loudly instead of silently misbehaving.
 */
class SwaggerModule {
  static mergeWebhooks() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static createDocument() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static loadPluginMetadata() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static serveStatic() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static serveDocuments() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static serveSwaggerUi() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static serveDefinitions() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
  static setup() {
    throw new Error('SwaggerModule is stubbed out under Jest and is not available in tests.');
  }
}

module.exports = { SwaggerModule };
