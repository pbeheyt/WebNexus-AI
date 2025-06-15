// src/shared/utils/object-utils.js

/**
 * Creates a robust deep copy of a given object.
 * This is safer than JSON.parse(JSON.stringify(obj)) as it handles more data types
 * and doesn't discard undefined properties.
 * @param {any} obj - The object or value to clone.
 * @returns {any} A deep copy of the object or value.
 */
export function robustDeepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => robustDeepClone(item));
  }

  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      newObj[key] = robustDeepClone(obj[key]);
    }
  }
  return newObj;
}
