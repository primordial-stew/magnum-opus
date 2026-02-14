import { SaxesParser } from 'saxes'

const { mkdir, readTextFile, writeTextFile } = Deno

const { NotFound } = Deno.errors

async function loadCheckpoint<T>(name: string, load: () => Promise<T>): Promise<T> {
    try {
        return JSON.parse(await readTextFile(`.cache/${name}.json`))
    } catch (error) {
        if (error instanceof NotFound) {
            const data = await load()
            await mkdir('.cache', { recursive: true })
            await writeTextFile(`.cache/${name}.json`, JSON.stringify(data, null, 2))
            return data
        } else {
            throw error
        }
    }
}

async function fetchTmxUrl(): Promise<string> {
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

async function fetchTmxStream(url: string): Promise<ReadableStream<string>> {
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

async function parseTmxStream(
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

const tokenRegex = new RegExp(/[^ ]+/gu)

function tokenizeText(text: string) {
    return text.toLowerCase().match(tokenRegex)
}

const sentences = await loadCheckpoint(
    'sentences',
    async () => {
        const sentences: Array<[Array<string>, Array<string>]> = []

        await parseTmxStream(
            await fetchTmxUrl().then(fetchTmxStream),
            (text0, text1) => {
                const tokens0 = tokenizeText(text0)
                const tokens1 = tokenizeText(text1)
                if (tokens0 !== null && tokens1 !== null) {
                    sentences.push([tokens0, tokens1])
                }
            }
        )

        return sentences
    }
)

console.log(sentences)
