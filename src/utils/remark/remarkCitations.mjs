const REFERENCE_HEADINGS = new Set(["参考资料", "参考文献", "references"]);
const REFERENCE_KEY_PREFIX = /^\s*\[@([A-Za-z0-9:_-]+)\]\s*/;
const INLINE_CITATION_PATTERN = /\[@([^\]]+)\]/g;

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeKey(value) {
  return value.trim().toLowerCase();
}

function referenceId(key) {
  return `ref-${normalizeKey(key).replace(/[^a-z0-9_-]+/g, "-")}`;
}

function appendClass(node, className) {
  node.data ??= {};
  node.data.hProperties ??= {};

  const current = node.data.hProperties.className;
  if (Array.isArray(current)) {
    if (!current.includes(className)) {
      current.push(className);
    }
    return;
  }

  if (typeof current === "string" && current.length > 0) {
    node.data.hProperties.className = [current, className];
    return;
  }

  node.data.hProperties.className = [className];
}

function getNodeText(node) {
  if (!node) {
    return "";
  }

  if (typeof node.value === "string") {
    return node.value;
  }

  if (!Array.isArray(node.children)) {
    return "";
  }

  return node.children.map((child) => getNodeText(child)).join("");
}

function findReferenceList(root) {
  const children = Array.isArray(root.children) ? root.children : [];

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (node?.type !== "heading") {
      continue;
    }

    const headingText = normalizeText(getNodeText(node));
    if (!REFERENCE_HEADINGS.has(headingText)) {
      continue;
    }

    for (let cursor = index + 1; cursor < children.length; cursor += 1) {
      const candidate = children[cursor];
      if (!candidate) {
        continue;
      }

      if (candidate.type === "list") {
        return candidate;
      }

      if (candidate.type !== "paragraph") {
        break;
      }
    }
  }

  return null;
}

function extractReferenceKey(listItem) {
  const firstBlock = listItem.children?.[0];
  if (!firstBlock || firstBlock.type !== "paragraph" || !Array.isArray(firstBlock.children)) {
    return null;
  }

  const firstInline = firstBlock.children[0];
  if (!firstInline || firstInline.type !== "text" || typeof firstInline.value !== "string") {
    return null;
  }

  const match = firstInline.value.match(REFERENCE_KEY_PREFIX);
  if (!match) {
    return null;
  }

  firstInline.value = firstInline.value.slice(match[0].length);
  if (firstInline.value.length === 0) {
    firstBlock.children.shift();
  }

  return normalizeKey(match[1]);
}

function buildCitationHtml(keys, references, file) {
  const uniqueKeys = [];

  for (const rawKey of keys) {
    const key = normalizeKey(rawKey).replace(/^@/, "");
    if (!key || uniqueKeys.includes(key)) {
      continue;
    }
    uniqueKeys.push(key);
  }

  const items = [];

  for (const key of uniqueKeys) {
    const reference = references.get(key);
    if (!reference) {
      file.message(`Unknown citation key: ${key}`);
      return null;
    }

    items.push(
      `<a href="#${reference.id}" class="article-citation__link" aria-label="查看参考资料 ${reference.number}">${reference.number}</a>`,
    );
  }

  if (items.length === 0) {
    return null;
  }

  return `<sup class="article-citation">[${items.join('<span class="article-citation__sep">, </span>')}]</sup>`;
}

function replaceInlineCitations(value, references, file) {
  let match;
  let lastIndex = 0;
  const nodes = [];

  INLINE_CITATION_PATTERN.lastIndex = 0;

  while ((match = INLINE_CITATION_PATTERN.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({
        type: "text",
        value: value.slice(lastIndex, match.index),
      });
    }

    const html = buildCitationHtml(match[1].split(/[;,]/), references, file);
    if (html) {
      nodes.push({ type: "html", value: html });
    } else {
      nodes.push({ type: "text", value: match[0] });
    }

    lastIndex = INLINE_CITATION_PATTERN.lastIndex;
  }

  if (lastIndex === 0) {
    return null;
  }

  if (lastIndex < value.length) {
    nodes.push({
      type: "text",
      value: value.slice(lastIndex),
    });
  }

  return nodes;
}

function transformNode(node, references, referenceList, file) {
  if (!node || node === referenceList || !Array.isArray(node.children)) {
    return;
  }

  const nextChildren = [];

  for (const child of node.children) {
    if (child?.type === "text" && typeof child.value === "string") {
      const replacement = replaceInlineCitations(child.value, references, file);
      if (replacement) {
        nextChildren.push(...replacement);
        continue;
      }
    }

    transformNode(child, references, referenceList, file);
    nextChildren.push(child);
  }

  node.children = nextChildren;
}

export default function remarkCitations() {
  return (tree, file) => {
    const referenceList = findReferenceList(tree);
    if (!referenceList || !Array.isArray(referenceList.children)) {
      return;
    }

    appendClass(referenceList, "reference-list");

    const references = new Map();

    referenceList.children.forEach((listItem, index) => {
      if (!listItem || listItem.type !== "listItem") {
        return;
      }

      const key = extractReferenceKey(listItem);
      if (!key) {
        file.message(`Reference item ${index + 1} is missing a citation key.`);
        return;
      }

      const id = referenceId(key);
      listItem.data ??= {};
      listItem.data.hProperties ??= {};
      listItem.data.hProperties.id = id;
      listItem.data.hProperties["data-reference-key"] = key;
      appendClass(listItem, "reference-item");

      references.set(key, {
        id,
        number: index + 1,
      });
    });

    transformNode(tree, references, referenceList, file);
  };
}
