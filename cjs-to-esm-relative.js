// cjs-to-esm-relative.js

/**
 * This transform converts CommonJS modules (`require`, `module.exports`, `exports.name`)
 * to ES6 Modules (`import`, `export default`, `export const/let/var/function`).
 *
 * Key Features:
 * - Handles `const foo = require('bar')` -> `import foo from 'bar'`
 * - Handles `const { a, b } = require('bar')` -> `import { a, b } from 'bar'`
 * - Handles `require('bar')` (side effects) -> `import 'bar'`
 * - Handles `module.exports = foo` -> `export default foo`
 * - Handles `exports.foo = bar` -> `export const foo = bar` (or function/let/var)
 * - **Adds '.js' extension to relative import paths** (e.g., './utils' -> './utils.js')
 *   - Skips adding extension if one already exists (.js, .jsx, .ts, .tsx, .json, etc.)
 *   - Skips adding extension for node_modules imports.
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const usedImportNames = new Set(); // Keep track of generated import names to avoid conflicts

  // Helper to check if a path is relative
  const isRelativePath = (p) => p.startsWith('.');

  // Helper to check if a path already has a common extension
  const hasExtension = (p) =>
    /\.(js|jsx|ts|tsx|mjs|cjs|json|css|scss|less|sass|vue|svelte)$/i.test(p);

  // Helper to add .js extension if relative and doesn't have one
  const ensureJSExtension = (originalPath) => {
    if (isRelativePath(originalPath) && !hasExtension(originalPath)) {
      return `${originalPath}.js`;
    }
    return originalPath;
  };

  // --- 1. Convert `require` to `import` ---
  root
    .find(j.VariableDeclaration, {
      declarations: [
        {
          init: {
            type: 'CallExpression',
            callee: { name: 'require' },
          },
        },
      ],
    })
    .forEach((path) => {
      const declaration = path.value.declarations[0];
      const requireArg = declaration.init.arguments[0];

      if (requireArg && requireArg.type === 'Literal') {
        const sourcePath = ensureJSExtension(requireArg.value);
        let importSpecifiers = [];
        let importKind = 'value'; // Default import kind

        if (declaration.id.type === 'Identifier') {
          // const foo = require('bar'); -> import foo from 'bar';
          importSpecifiers.push(j.importDefaultSpecifier(j.identifier(declaration.id.name)));
          usedImportNames.add(declaration.id.name);
        } else if (declaration.id.type === 'ObjectPattern') {
          // const { a, b } = require('bar'); -> import { a, b } from 'bar';
          declaration.id.properties.forEach((prop) => {
            if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.value.type === 'Identifier') {
              // Handle potential renaming: { originalName: localName }
              if (prop.key.name === prop.value.name) {
                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name)));
              } else {
                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name), j.identifier(prop.value.name)));
              }
              usedImportNames.add(prop.value.name);
            } else if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && prop.value.type === 'Identifier') {
              // Handle potential renaming: { originalName: localName } (alternative AST structure)
              if (prop.key.name === prop.value.name) {
                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name)));
              } else {
                 importSpecifiers.push(j.importSpecifier(j.identifier(prop.key.name), j.identifier(prop.value.name)));
              }
               usedImportNames.add(prop.value.name);
            }
             // Add handling for other property types if needed (e.g., SpreadElement)
          });
        } else {
          // Skip complex destructuring for simplicity
          console.warn(`Skipping complex require declaration in ${file.path}`);
          return;
        }

        const importDeclaration = j.importDeclaration(importSpecifiers, j.literal(sourcePath), importKind);
        // Add comments from the original declaration to the new import
        importDeclaration.comments = path.value.comments;
        j(path).replaceWith(importDeclaration);
      }
    });

  // Handle side-effect imports: require('foo');
  root
    .find(j.ExpressionStatement, {
      expression: {
        type: 'CallExpression',
        callee: { name: 'require' },
      },
    })
    .forEach((path) => {
      const requireArg = path.value.expression.arguments[0];
      if (requireArg && requireArg.type === 'Literal') {
        const sourcePath = ensureJSExtension(requireArg.value);
        const importDeclaration = j.importDeclaration([], j.literal(sourcePath));
        importDeclaration.comments = path.value.comments;
        j(path).replaceWith(importDeclaration);
      }
    });

  // --- 2. Convert `module.exports` to `export default` ---
  root
    .find(j.ExpressionStatement, {
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: { name: 'module' },
          property: { name: 'exports' },
        },
      },
    })
    .forEach((path) => {
      const exportDeclaration = j.exportDefaultDeclaration(path.value.expression.right);
      exportDeclaration.comments = path.value.comments;
      j(path).replaceWith(exportDeclaration);
    });

  // --- 3. Convert `exports.foo = bar` to `export const foo = bar` (or function/let/var) ---
  root
    .find(j.ExpressionStatement, {
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: { name: 'exports' },
        },
      },
    })
    .forEach((path) => {
      const assignment = path.value.expression;
      const exportName = assignment.left.property.name;
      const exportValue = assignment.right;

      let declaration;

      // Check if the value being assigned is a function expression
      if (exportValue.type === 'FunctionExpression' || exportValue.type === 'ArrowFunctionExpression') {
        // Convert to an export function declaration
        declaration = j.functionDeclaration(
          j.identifier(exportName),
          exportValue.params,
          exportValue.body,
          exportValue.generator,
          exportValue.async
        );
        // Copy comments from the function expression if they exist
         if (exportValue.comments) {
           declaration.comments = exportValue.comments;
         }
      } else {
        // Default to exporting a const variable declaration
        declaration = j.variableDeclaration('const', [
          j.variableDeclarator(j.identifier(exportName), exportValue),
        ]);
         // Copy comments from the original statement if they exist
         if (path.value.comments) {
           declaration.comments = path.value.comments;
         }
      }


      const exportNamedDeclaration = j.exportNamedDeclaration(declaration);
      // Preserve comments from the original ExpressionStatement onto the new ExportNamedDeclaration
       if (path.value.comments && !declaration.comments) { // Avoid duplicating comments
         exportNamedDeclaration.comments = path.value.comments;
       }

      j(path).replaceWith(exportNamedDeclaration);
    });

  // --- 4. Convert simple `exports = module.exports = ...` (often seen in older UMD patterns) ---
  // This is a basic attempt and might need refinement for complex UMD
  root
    .find(j.ExpressionStatement, {
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: { name: 'exports' },
        right: {
          type: 'AssignmentExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            object: { name: 'module' },
            property: { name: 'exports' },
          },
        },
      },
    })
    .forEach((path) => {
      const exportValue = path.value.expression.right.right;
      const exportDeclaration = j.exportDefaultDeclaration(exportValue);
      exportDeclaration.comments = path.value.comments;
      j(path).replaceWith(exportDeclaration);
    });


  return root.toSource({ quote: 'single' }); // Use single quotes for consistency
}