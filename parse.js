const  NodeTypes  = {
    ROOT: 'ROOT',
    ELEMENT: 'ELEMENT',
    TEXT: 'TEXT',
    COMMENT: 'COMMENT',
    SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION',
    INTERPOLATION: 'INTERPOLATION',
    ATTRIBUTE: 'ATTRIBUTE',
    DIRECTIVE: 'DIRECTIVE',
    // containers
    COMPOUND_EXPRESSION: 'COMPOUND_EXPRESSION',
    IF: 'IF',
    IF_BRANCH: 'IF_BRANCH',
    FOR: 'FOR',
    TEXT_CALL: 'TEXT_CALL',
    // codegen
    VNODE_CALL: 'VNODE_CALL',
    JS_CALL_EXPRESSION: 'JS_CALL_EXPRESSION',
    JS_OBJECT_EXPRESSION: 'JS_OBJECT_EXPRESSION',
    JS_PROPERTY: 'JS_PROPERTY',
    JS_ARRAY_EXPRESSION: 'JS_ARRAY_EXPRESSION',
    JS_FUNCTION_EXPRESSION: 'JS_FUNCTION_EXPRESSION',
    JS_CONDITIONAL_EXPRESSION: 'JS_CONDITIONAL_EXPRESSION',
    JS_CACHE_EXPRESSION: 'JS_CACHE_EXPRESSION',
}
const delimiters = ['{{', '}}']
function parseChildren(context, ancestors) {
    const nodes = [];
    while (!isEnd(context, ancestors)) {
      const s = context.source;
      let node = null;
      if (startsWith(s, delimiters[0])) {
          // 解析 '{{' '}}'
          node = parseInterpolation(context)
        } else if(s[0] === '<'){
          if (/[a-z]/i.test(s[1])){
            // 解析 dom
              node  = parseElement(context, ancestors)
          }
      }
      if (!node) {
        // 解析文字 '/n    '换行符也是
          node = parseText(context)
      }
      nodes.push(node)
    }

    // 将循环nodes, 换行符置为空
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.type === NodeTypes.TEXT && !/[^\t\r\n\f ]/.test(node.content)) {
        nodes[i] = null
      }
    }
    // 过滤掉空node
    return nodes.filter(Boolean)
}

// 解析dom
function parseElement(context, ancestors) {
  // Start tag.
const element = parseTag(context, TagType.Start)

// Children.
ancestors.push(element)
const children = parseChildren(context, ancestors)
ancestors.pop()

element.children = children

// End tag. 最后一个是空字符串
if (startsWithEndTagOpen(context.source, element.tag)) {
  parseTag(context, TagType.End)
}

return element
}

// 解析文字或换行符，以到dom起始标签'<'或'{{'为止
function parseText(context) {
  const endTokens = ['<', delimiters[0]]
  let endIndex = context.source.length
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content,
  }
}

function parseTextData(
    context,
    length,
  ) {
    const rawText = context.source.slice(0, length)
    advanceBy(context, length)
    return rawText
  }
const TagType = {
    Start: 'Start',
    End: 'End'
}

// 解析标签属性，不管是class还是model，还是事件，全都放进props
function parseTag(
    context,
    type
  ) {
    // Tag open.
    const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)
    const tag = match[1]
  
    advanceBy(context, match[0].length)
    advanceSpaces(context)
  
    // Attributes.
    let props = parseAttributes(context, type)
  
    // Tag close.
    let isSelfClosing = false
    if (context.source.length === 0) {
    //   emitError(context, ErrorCodes.EOF_IN_TAG)
    } else {
      isSelfClosing = startsWith(context.source, '/>')
      advanceBy(context, isSelfClosing ? 2 : 1)
    }
  
    if (type === TagType.End) {
      return
    }
  
    return {
      type: NodeTypes.ELEMENT,
      tag,
      props,
      isSelfClosing,
      children: [],
    }
  }

function parseAttributes(
  context,
  type
) {
  const props = []
  const attributeNames = new Set()
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    const attr = parseAttribute(context, attributeNames)

    if (type === TagType.Start) {
      props.push(attr)
    }
    advanceSpaces(context)
  }
  return props
}

function parseAttribute(
    context,
    nameSet
  ){
    // Name.
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)
    const name = match[0]
    nameSet.add(name)
  
    advanceBy(context, name.length)
  
    // Value
    let value = undefined
  
    if (/^[\t\r\n\f ]*=/.test(context.source)) {
      advanceSpaces(context)
      advanceBy(context, 1)
      advanceSpaces(context)
      value = parseAttributeValue(context)
    }
  
    return {
      type: NodeTypes.ATTRIBUTE,
      name,
      value: value && {
        type: NodeTypes.TEXT,
        content: value.content,
      }
    }
  }

function parseAttributeValue(context) {
  let content = '';

  const quote = context.source[0]
  const isQuoted = quote === `"` || quote === `'`
  if (isQuoted) {
    // Quoted value.
    advanceBy(context, 1)

    const endIndex = context.source.indexOf(quote)
    if (endIndex === -1) {
      content = parseTextData(
        context,
        context.source.length
      )
    } else {
      content = parseTextData(context, endIndex)
      advanceBy(context, 1)
    }
  } else {
    // Unquoted
    const match = /^[^\t\r\n\f >]+/.exec(context.source)
    if (!match) {
      return undefined
    }
    content = parseTextData(context, match[0].length)
  }

  return { content, isQuoted }
}

function advanceBy(context, numberOfCharacters) {
  const { source } = context
  context.source = source.slice(numberOfCharacters)
}

function advanceSpaces(context) {
  const match = /^[\t\r\n\f ]+/.exec(context.source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

// 
function parseInterpolation(
  context,
) {
  const [open, close] = delimiters
  const closeIndex = context.source.indexOf(close, open.length)

  advanceBy(context, open.length)
  const rawContentLength = closeIndex - open.length
  const preTrimContent = parseTextData(context, rawContentLength)
  const content = preTrimContent.trim()
  advanceBy(context, close.length)

  return {
    content: {
      content,
    },
  }
}

function createParserContext(
  content,
){
  return {
    originalSource: content,
    source: content,
  }
}
function startsWith(source, searchString) {
  return source.startsWith(searchString)
}

function isEnd(
  context,
  ancestors
) {
  const s = context.source
  if (startsWith(s, '</')) {
    // TODO: probably bad performance
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true
      }
    }
  }
  return !s
}

function startsWithEndTagOpen(source, tag) {
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}
export default function parse(content) {
    const context = createParserContext(content)
    const tree = parseChildren(context, [])
    console.log('parse', tree);
}
