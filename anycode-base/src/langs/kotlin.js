const query = `
; Identifiers
(simple_identifier) @variable

; it keyword inside lambdas
; FIXME: This will highlight the keyword outside of lambdas since tree-sitter
;        does not allow us to check for arbitrary nestation
((simple_identifier) @variable.builtin
  (#eq? @variable.builtin "it"))

; field keyword inside property getter/setter
; FIXME: This will highlight the keyword outside of getters and setters
;        since tree-sitter does not allow us to check for arbitrary nestation
((simple_identifier) @variable.builtin
  (#eq? @variable.builtin "field"))

[
  "this"
  "super"
  "this@"
  "super@"
] @variable.builtin

; NOTE: for consistency with "super@"
(super_expression
  "@" @variable.builtin)

(class_parameter
  (simple_identifier) @variable.member)

; NOTE: temporary fix for treesitter bug that causes delay in file opening
;(class_body
;  (property_declaration
;    (variable_declaration
;      (simple_identifier) @variable.member)))
; id_1.id_2.id_3: id_2 and id_3 are assumed as object properties
(_
  (navigation_suffix
    (simple_identifier) @variable.member))

; SCREAMING CASE identifiers are assumed to be constants
((simple_identifier) @constant
  (#lua-match? @constant "^[A-Z][A-Z0-9_]*$"))

(_
  (navigation_suffix
    (simple_identifier) @constant
    (#lua-match? @constant "^[A-Z][A-Z0-9_]*$")))

(enum_entry
  (simple_identifier) @constant)

(type_identifier) @type

; '?' operator, replacement for Java @Nullable
(nullable_type) @punctuation.special

(type_alias
  (type_identifier) @type.definition)

((type_identifier) @type.builtin
  (#any-of? @type.builtin
    "Byte" "Short" "Int" "Long" "UByte" "UShort" "UInt" "ULong" "Float" "Double" "Boolean" "Char"
    "String" "Array" "ByteArray" "ShortArray" "IntArray" "LongArray" "UByteArray" "UShortArray"
    "UIntArray" "ULongArray" "FloatArray" "DoubleArray" "BooleanArray" "CharArray" "Map" "Set"
    "List" "EmptyMap" "EmptySet" "EmptyList" "MutableMap" "MutableSet" "MutableList"))

(package_header
  "package" @keyword
  .
  (identifier
    (simple_identifier) @module))

(import_header
  "import" @keyword)

; The last simple_identifier in a import_header will always either be a function
; or a type. Classes can appear anywhere in the import path, unlike functions
(import_header
  (identifier
    (simple_identifier) @type @_import)
  (import_alias
    (type_identifier) @type.definition)?
  (#lua-match? @_import "^[A-Z]"))

(import_header
  (identifier
    (simple_identifier) @function @_import .)
  (import_alias
    (type_identifier) @function)?
  (#lua-match? @_import "^[a-z]"))

(label) @label

; Function definitions
(function_declaration
  (simple_identifier) @function)

(getter
  "get" @function.builtin)

(setter
  "set" @function.builtin)

(primary_constructor) @constructor

(secondary_constructor
  "constructor" @constructor)

(constructor_invocation
  (user_type
    (type_identifier) @constructor))

(anonymous_initializer
  "init" @constructor)

(parameter
  (simple_identifier) @variable.parameter)

(parameter_with_optional_type
  (simple_identifier) @variable.parameter)

; lambda parameters
(lambda_literal
  (lambda_parameters
    (variable_declaration
      (simple_identifier) @variable.parameter)))

; Function calls
; function()
(call_expression
  .
  (simple_identifier) @function.call)

; ::function
(callable_reference
  .
  (simple_identifier) @function.call)

; object.function() or object.property.function()
(call_expression
  (navigation_expression
    (navigation_suffix
      (simple_identifier) @function.call) .))

(call_expression
  .
  (simple_identifier) @function.builtin
  (#any-of? @function.builtin
    "arrayOf" "arrayOfNulls" "byteArrayOf" "shortArrayOf" "intArrayOf" "longArrayOf" "ubyteArrayOf"
    "ushortArrayOf" "uintArrayOf" "ulongArrayOf" "floatArrayOf" "doubleArrayOf" "booleanArrayOf"
    "charArrayOf" "emptyArray" "mapOf" "setOf" "listOf" "emptyMap" "emptySet" "emptyList"
    "mutableMapOf" "mutableSetOf" "mutableListOf" "print" "println" "error" "TODO" "run"
    "runCatching" "repeat" "lazy" "lazyOf" "enumValues" "enumValueOf" "assert" "check"
    "checkNotNull" "require" "requireNotNull" "with" "suspend" "synchronized"))

; Literals
[
  (line_comment)
  (multiline_comment)
] @comment @spell

((multiline_comment) @comment.documentation
  (#lua-match? @comment.documentation "^/[*][*][^*].*[*]/$"))

(shebang_line) @keyword.directive

(real_literal) @number.float

[
  (integer_literal)
  (long_literal)
  (hex_literal)
  (bin_literal)
  (unsigned_literal)
] @number

[
  ;"null"
  ; should be highlighted the same as booleans
  (boolean_literal)
] @boolean

(character_literal) @character

(string_literal) @string

; NOTE: Escapes not allowed in multi-line strings
(character_literal
  (character_escape_seq) @string.escape)

; There are 3 ways to define a regex
;    - "[abc]?".toRegex()
(call_expression
  (navigation_expression
    (string_literal) @string.regexp
    (navigation_suffix
      ((simple_identifier) @_function
        (#eq? @_function "toRegex")))))

;    - Regex("[abc]?")
(call_expression
  ((simple_identifier) @_function
    (#eq? @_function "Regex"))
  (call_suffix
    (value_arguments
      (value_argument
        (string_literal) @string.regexp))))

;    - Regex.fromLiteral("[abc]?")
(call_expression
  (navigation_expression
    ((simple_identifier) @_class
      (#eq? @_class "Regex"))
    (navigation_suffix
      ((simple_identifier) @_function
        (#eq? @_function "fromLiteral"))))
  (call_suffix
    (value_arguments
      (value_argument
        (string_literal) @string.regexp))))

; Keywords
(type_alias
  "typealias" @keyword)

(companion_object
  "companion" @keyword)

[
  (class_modifier)
  (member_modifier)
  (function_modifier)
  (property_modifier)
  (platform_modifier)
  (variance_modifier)
  (parameter_modifier)
  (visibility_modifier)
  (reification_modifier)
  (inheritance_modifier)
] @type.qualifier

[
  "val"
  "var"
  "enum"
  "class"
  "object"
  "interface"
  ;	"typeof" ; NOTE: It is reserved for future use
] @keyword

[
  "return"
  "return@"
] @keyword.return

"suspend" @keyword

"fun" @keyword

[
  "if"
  "else"
  "when"
] @keyword

[
  "for"
  "do"
  "while"
  "continue"
  "continue@"
  "break"
  "break@"
] @keyword

[
  "try"
  "catch"
  "throw"
  "finally"
] @keyword

(annotation
  "@" @attribute
  (use_site_target)? @attribute)

(annotation
  (user_type
    (type_identifier) @attribute))

(annotation
  (constructor_invocation
    (user_type
      (type_identifier) @attribute)))

(file_annotation
  "@" @attribute
  "file" @attribute
  ":" @attribute)

(file_annotation
  (user_type
    (type_identifier) @attribute))

(file_annotation
  (constructor_invocation
    (user_type
      (type_identifier) @attribute)))

; Operators & Punctuation
[
  "!"
  "!="
  "!=="
  "="
  "=="
  "==="
  ">"
  ">="
  "<"
  "<="
  "||"
  "&&"
  "+"
  "++"
  "+="
  "-"
  "--"
  "-="
  "*"
  "*="
  "/"
  "/="
  "%"
  "%="
  "?."
  "?:"
  "!!"
  "is"
  "!is"
  "in"
  "!in"
  "as"
  "as?"
  ".."
  "->"
] @operator

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  "."
  ","
  ";"
  ":"
  "::"
] @punctuation.delimiter

(super_expression
  [
    "<"
    ">"
  ] @punctuation.delimiter)

(type_arguments
  [
    "<"
    ">"
  ] @punctuation.delimiter)

(type_parameters
  [
    "<"
    ">"
  ] @punctuation.delimiter)

; NOTE: interpolated_identifiers can be highlighted in any way
(string_literal
  "$" @punctuation.special
  (interpolated_identifier) @none @variable)

`

let indent = { width: 4, unit: " " };
let comment = "//";

export default {
  query, indent, comment
}