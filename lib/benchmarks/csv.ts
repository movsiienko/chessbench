export function parseCsvRecords(contents: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let quoted = false
  let fieldStarted = false

  const pushField = () => {
    record.push(field)
    field = ""
    fieldStarted = false
  }

  const pushRecord = () => {
    pushField()

    if (record.length > 1 || record.some((value) => value.length > 0)) {
      records.push(record)
    }

    record = []
  }

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]

    if (quoted) {
      if (char === '"' && contents[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === ",") {
      pushField()
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && contents[index + 1] === "\n") {
        index += 1
      }
      pushRecord()
    } else if (char === '"' && !fieldStarted && field.length === 0) {
      quoted = true
      fieldStarted = true
    } else {
      field += char
      fieldStarted = true
    }
  }

  if (quoted) {
    throw new Error("Unclosed quoted CSV field")
  }

  if (field.length > 0 || fieldStarted || record.length > 0) {
    pushRecord()
  }

  return records
}
