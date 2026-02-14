import { SaxesParser } from 'saxes'

type Bpe = {
    texts: Array<Array<string>>,
    totalLength: number,
    map: Map<string, number>,
    bestSymbol: Array<string>,
    bestCount: number,
}

async function fetchUrl(): Promise<string> {
    const url = new URL('https://opus.nlpl.eu/opusapi')

    url.searchParams.set('corpus', 'Tatoeba')
    url.searchParams.set('source', 'en')
    url.searchParams.set('target', 'es')
    url.searchParams.set('preprocessing', 'tmx')
    url.searchParams.set('version', 'latest')

    const response = await fetch(url)
    const { ok, status } = response

    if (!ok) {
        throw new Error(`OPUS API Query: status ${status}: ${await response.text()}`)
    }

    return (await response.json())
        .corpora[0].url
}

async function fetchStream(url: string): Promise<ReadableStream<string>> {
    const response = await fetch(url)
    const { body, ok, status } = response

    if (!ok) {
        throw new Error(`OPUS TMX Download: status ${status}: ${await response.text()}`)
    }

    if (body === null) {
        throw new Error(`OPUS TMX Download: empty`)
    }

    return body
        .pipeThrough(new DecompressionStream("gzip"))
        .pipeThrough(new TextDecoderStream())
}

async function parseTmx(
    stream: ReadableStream<string>,
    callback: (text0: string, text1: string) => void,
) {
    const parser = new SaxesParser({ xmlns: false })

    let which = 0
    let capture = false
    let text0 = ''
    let text1 = ''

    parser.on("error", (error) => {
        throw new Error(`TMX Parse: XML error: ${error}`)
    })

    parser.on("opentag", ({ name, attributes }) => {
        switch (name) {
            case 'tuv':
                const lang = attributes['xml:lang']

                if (lang === 'en') {
                    which = 0
                } else if (lang === 'es') {
                    which = 1
                }

                break
            case 'seg':
                capture = true
                break
        }
    })

    parser.on("closetag", ({ name }) => {
        switch (name) {
            case 'tu':
                callback(text0, text1)
                break
            case 'seg':
                capture = false
                break
        }
    })

    parser.on("text", (text) => {
        if (capture) {
            if (which === 0) {
                text0 = text
            } else {
                text1 = text
            }
        }
    })

    for await (const chunk of stream) {
        parser.write(chunk)
    }
}

const bpe = {
    texts: [],
    totalLength: 0,
    map: new Map<string, number>(),
    bestSymbol: [],
    bestCount: 0,
}

function addBpeText(bpe: Bpe, text: string) {
    bpe.texts.push([...text.toLowerCase()])
}

const delimiterRegex = new RegExp(/[^\p{L}]/u)

function countBpe(bpe: Bpe) {
    bpe.totalLength = 0
    bpe.map.clear()
    bpe.bestSymbol = []
    bpe.bestCount = 0

    for (let t = 0; t < bpe.texts.length; t++) {
        const text = bpe.texts[t]
        bpe.totalLength += text.length

        for (let i = 0; i < text.length - 1; i++) {
            if (delimiterRegex.test(text[i]) || delimiterRegex.test(text[i + 1])) {
                continue
            }

            const symbol = `${text[i]} ${text[i + 1]}`
            const count = (bpe.map.get(symbol) ?? 0) + 1

            bpe.map.set(symbol, count)

            if (count > bpe.bestCount) {
                bpe.bestSymbol = [text[i], text[i + 1]]
                bpe.bestCount = count
            }
        }
    }
}

function applyBpe(bpe: Bpe) {
    const bestSymbol = `${bpe.bestSymbol[0]}${bpe.bestSymbol[1]}`

    for (let t = 0; t < bpe.texts.length; t++) {
        const oldText = bpe.texts[t]
        const newText = []

        for (let i = 0; i < oldText.length; i++) {
            if (i < oldText.length - 1 && oldText[i] === bpe.bestSymbol[0] && oldText[i + 1] === bpe.bestSymbol[1]) {
                newText.push(bestSymbol)
                i += 1
            } else {
                newText.push(oldText[i])
            }
        }

        bpe.texts[t] = newText
    }
}

await parseTmx(
    await fetchUrl().then(fetchStream),
    (text0, text1) => {
        addBpeText(bpe, text0)
    }
)

countBpe(bpe)

const MERGES = 1000

for (let i = 0; i < MERGES; i++) {
    console.log(`Applying BPE for ${bpe.bestSymbol}: ${100 * i / MERGES}% (${bpe.totalLength} / ${bpe.map.size})`)
    applyBpe(bpe)
    countBpe(bpe)
}

console.log(bpe.texts)
console.log(bpe.totalLength)
