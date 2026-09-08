/**
 * Jest-only CJS stand-in for @nestjs/mapped-types/dist/type-helpers.utils.js.
 *
 * Same problem as nest-load-package-util.shim.cjs: @nestjs/mapped-types ships as
 * real ESM and this file does `const require = createRequire(import.meta.url);`
 * at module scope, which Node's CJS parser can't even parse. It backs PartialType/
 * PickType/OmitType/IntersectionType, used by real Update DTOs (e.g.
 * UpdateStudentDto, UpdateAttendanceSessionDto, UpdateChurchDto), so this is a
 * faithful port of the original logic — only the `require` acquisition changes,
 * swapped for the ambient CJS `require` already in scope, which resolves peer
 * packages (class-validator, class-transformer) identically to createRequire's
 * module-relative resolution for packages hoisted into a flat node_modules.
 */
const logger_1 = require('@nestjs/common');
const logger = new logger_1.Logger('MappedTypes');

function isClassValidatorAvailable() {
  try {
    require('class-validator');
    return true;
  } catch {
    return false;
  }
}

function isClassTransformerAvailable() {
  try {
    require('class-transformer');
    return true;
  } catch {
    return false;
  }
}

function applyIsOptionalDecorator(targetClass, propertyKey) {
  if (!isClassValidatorAvailable()) return;
  const classValidator = require('class-validator');
  const decoratorFactory = classValidator.IsOptional();
  decoratorFactory(targetClass.prototype, propertyKey);
}

function applyValidateIfDefinedDecorator(targetClass, propertyKey) {
  if (!isClassValidatorAvailable()) return;
  const classValidator = require('class-validator');
  const decoratorFactory = classValidator.ValidateIf((_, value) => value !== undefined);
  decoratorFactory(targetClass.prototype, propertyKey);
}

function inheritValidationMetadata(parentClass, targetClass, isPropertyInherited) {
  if (!isClassValidatorAvailable()) return;
  try {
    const classValidator = require('class-validator');
    const metadataStorage = classValidator.getMetadataStorage
      ? classValidator.getMetadataStorage()
      : classValidator.getFromContainer(classValidator.MetadataStorage);
    const targetMetadata = metadataStorage.getTargetValidationMetadatas(parentClass, null, false, false);
    return targetMetadata
      .filter(({ propertyName }) => !isPropertyInherited || isPropertyInherited(propertyName))
      .map((value) => {
        const originalType = Reflect.getMetadata('design:type', parentClass.prototype, value.propertyName);
        if (originalType) {
          Reflect.defineMetadata('design:type', originalType, targetClass.prototype, value.propertyName);
        }
        metadataStorage.addValidationMetadata({ ...value, target: targetClass });
        return value.propertyName;
      });
  } catch (err) {
    logger.error(`Validation ("class-validator") metadata cannot be inherited for "${parentClass.name}" class.`);
    logger.error(err);
  }
}

function inheritTransformerMetadata(key, parentClass, targetClass, isPropertyInherited, stackDecorators = true) {
  let classTransformer;
  try {
    classTransformer = require('class-transformer/cjs/storage');
  } catch {
    classTransformer = require('class-transformer/storage');
  }
  const metadataStorage = classTransformer.defaultMetadataStorage;
  while (parentClass && parentClass !== Object) {
    if (metadataStorage[key].has(parentClass)) {
      const metadataMap = metadataStorage[key];
      const parentMetadata = metadataMap.get(parentClass);
      const targetMetadataEntries = Array.from(parentMetadata.entries())
        .filter(([k]) => !isPropertyInherited || isPropertyInherited(k))
        .map(([k, metadata]) => {
          if (Array.isArray(metadata)) {
            return [k, metadata.map((item) => ({ ...item, target: targetClass }))];
          }
          return [k, { ...metadata, target: targetClass }];
        });
      if (metadataMap.has(targetClass)) {
        const existingRules = metadataMap.get(targetClass).entries();
        const mergeMap = new Map();
        [existingRules, targetMetadataEntries].forEach((entries) => {
          for (const [valueKey, value] of entries) {
            if (mergeMap.has(valueKey) && stackDecorators) {
              const parentValue = mergeMap.get(valueKey);
              if (Array.isArray(parentValue)) {
                parentValue.push(...(Array.isArray(value) ? value : [value]));
              }
            } else {
              mergeMap.set(valueKey, value);
            }
          }
        });
        metadataMap.set(targetClass, mergeMap);
      } else {
        metadataMap.set(targetClass, new Map(targetMetadataEntries));
      }
    }
    parentClass = Object.getPrototypeOf(parentClass);
  }
}

function inheritTransformationMetadata(parentClass, targetClass, isPropertyInherited, stackDecorators = true) {
  if (!isClassTransformerAvailable()) return;
  try {
    const transformMetadataKeys = ['_excludeMetadatas', '_exposeMetadatas', '_transformMetadatas', '_typeMetadatas'];
    transformMetadataKeys.forEach((key) =>
      inheritTransformerMetadata(key, parentClass, targetClass, isPropertyInherited, stackDecorators),
    );
  } catch (err) {
    logger.error(`Transformer ("class-transformer") metadata cannot be inherited for "${parentClass.name}" class.`);
    logger.error(err);
  }
}

function inheritPropertyInitializers(target, sourceClass, isPropertyInherited = () => true) {
  try {
    const tempInstance = new sourceClass();
    const propertyNames = Object.getOwnPropertyNames(tempInstance);
    propertyNames
      .filter(
        (propertyName) =>
          typeof tempInstance[propertyName] !== 'undefined' && typeof target[propertyName] === 'undefined',
      )
      .filter((propertyName) => isPropertyInherited(propertyName))
      .forEach((propertyName) => {
        target[propertyName] = tempInstance[propertyName];
      });
  } catch {
    // Matches upstream: swallowed when the source class can't be constructed with no args.
  }
}

module.exports = {
  applyIsOptionalDecorator,
  applyValidateIfDefinedDecorator,
  inheritValidationMetadata,
  inheritTransformationMetadata,
  inheritPropertyInitializers,
};
