// @FileName  :vmp_log.js
// @Time      :2025-12-10 20:33
// @Author    :Buluo
 let parse = require("@babel/parser").parse;
let traverse = require("@babel/traverse").default;
let generator = require("@babel/generator").default;
let fs = require("fs");
let types = require("@babel/types");
const type = require("@babel/types");

let js_code = fs.readFileSync("vmp_demo.js", encoding = "utf-8");
let ast = parse(js_code)

function insert_log(log_arguments) {
    if (!log_arguments instanceof Array) {
        Error("入参应该是数组类型")
    }
    let object_name = "console"
    let property_name = "log"
    let property_create = type.identifier(property_name)
    let object_create = type.identifier(object_name)
    // MemberExpression构建
    let MemberExpression_create = type.memberExpression(object_create, property_create)
    // t.callExpression
    let callExpression_create = type.callExpression(MemberExpression_create, log_arguments)
    return callExpression_create
}

function createSafeStringLiteral(value) {
    const node = type.stringLiteral(value);
    node.extra = {
        raw: JSON.stringify(value),  // 原始字符串，不编码
        rawValue: value
    };
    return node;
}
// 修改代码
traverse(ast, {
    ExpressionStatement: function (path) {
        let {node, parentPath, getNextSibling} = path;
        if (!type.isSwitchCase(parentPath) && !type.isBreakStatement(getNextSibling)) return;
        let {expression} = node;
        if (!type.isAssignmentExpression(expression)) return;
        let updateExpressions = [];
        path.traverse({
            UpdateExpression(_path) {
                updateExpressions.push(_path);
            }
        });
        let count = updateExpressions.length
        updateExpressions.reverse().forEach((_path, index) => {
            let countValue = index; // 或者 total - 1 - index
            let binaryExpression_create = type.binaryExpression(
                "-",
                type.identifier("k"),
                type.numericLiteral(countValue)
            );
            _path.parentPath.node.property = binaryExpression_create;
        });
    }
})
let num = 0
let keep_map = new Map()
// 核心插桩逻辑
traverse(ast, {
    ExpressionStatement: function (path) {
        let {node, parentPath, getNextSibling} = path;
        if (!type.isSwitchCase(parentPath) && !type.isBreakStatement(getNextSibling)) return;
        let {expression} = node;
        if (!type.isAssignmentExpression(expression)) return;
        let {left, right, operator} = expression;
        if (!type.isMemberExpression(left)) return;
        let return_string = "返回值===>"
        let return_string_create = createSafeStringLiteral(return_string)
        // 存在一个+=的计算
        if (operator !== "=") return;
        // 字符串插桩处理逻辑
        if (type.isBinaryExpression(right)) {
            let operator_list = ["+", "-", "*", "/", "%", "==", "===", "<", "<=", ">", "<<", ">>", "<<<", ">>>", "|", "^", "&", ">="]
            let in_right = type.cloneNode(right.right);
            let in_left =  type.cloneNode(right.left);
            let in_operator =right.operator;
            if (!operator_list.includes(in_operator)) return;
            let create_stringLiteral = "运算===>"
            let stringLiteral_create = createSafeStringLiteral(create_stringLiteral)
            let binaryExpression_create = type.binaryExpression(in_operator, in_left, in_right)
            let info_argument = [stringLiteral_create, binaryExpression_create, return_string_create,  type.cloneNode(left)]
            let call = insert_log(info_argument)
            keep_map.set(num, call)
            path.node.flage = type.NumericLiteral(num);
            // path.insertAfter(call)
            num++;
        } else if (type.isCallExpression(right)) {
            // call apply 函数调用插桩处理
            if (!type.isMemberExpression(right.callee)) return;
            let in_object =  type.cloneNode(right.callee.object);
            let in_property_name = right.callee.property.name;
            let in_arguments = right.arguments;
            if (in_property_name === "apply") {
                let first_string = "func ===>"
                let first_stringLiteral_create = createSafeStringLiteral(first_string)
                let this_string = "this===>"
                let this_string_create = createSafeStringLiteral(this_string)
                let this_argument =  type.cloneNode(in_arguments[0])
                const value = type.cloneNode( in_arguments[1]);
                let insert_index = `参数===>`
                let insert_index_create = createSafeStringLiteral(insert_index)
                let apply_argument = [first_stringLiteral_create, in_object, this_string_create, this_argument, insert_index_create, value, return_string_create, type.cloneNode(left)]
                let apply_log = insert_log(apply_argument)
                keep_map.set(num, apply_log)
                path.node.flage = type.NumericLiteral(num);
                // path.insertAfter(apply_log)
                num++;
            } else if (in_property_name === "call") {
                let first_string = "func ===>"
                let first_stringLiteral_create = createSafeStringLiteral(first_string)
                let this_string = "this===>"
                let this_string_create = createSafeStringLiteral(this_string)
                let this_argument =  type.cloneNode(in_arguments[0])
                let call_arguments = [first_stringLiteral_create, in_object, this_string_create, this_argument]
                if (in_arguments.length > 1) {
                    for (let index = 1; index < in_arguments.length; index++) {
                        let call_argument = in_arguments[index]
                        let index_string_create = createSafeStringLiteral(`参数${index}====>`)
                        call_arguments.push(index_string_create)
                        call_arguments.push( type.cloneNode(call_argument))
                    }
                }
                call_arguments.push(return_string_create)
                call_arguments.push( type.cloneNode(left))
                let call_log = insert_log(call_arguments)
                keep_map.set(num, call_log)
                path.node.flage = type.NumericLiteral(num);
                // path.insertAfter(call_log)
                num++;
            }
        }
    }
})

traverse(ast, {
    ExpressionStatement: function (path) {
        let {node, parentPath, getNextSibling} = path;
        if (!type.isSwitchCase(parentPath) && !type.isBreakStatement(getNextSibling)) return;
        let {expression} = node;
        if (!type.isAssignmentExpression(expression)) return;
        let operator = "++"
        let in_argument = type.identifier("k")
        path.traverse({
            BinaryExpression(_path) {
                _path.parentPath.node.property = type.updateExpression(operator, in_argument, true)
            }
        });
    }
})
// 插桩
traverse(ast, {
    ExpressionStatement: function (path) {
        let {node} = path;
        if (!node.flage) return
        let insert_path = keep_map.get(node.flage.value)
        path.insertAfter(insert_path)
    }
})
let code = generator(ast).code
fs.writeFileSync("./vmp_demo插桩后.js", code, "utf-8");