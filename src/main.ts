import { SaxesParser } from 'saxes'

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

async function fetchStream(url: string): Promise<ReadableStream> {
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
    stream: ReadableStream,
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

parseTmx(
    await fetchUrl().then(fetchStream),
    (text0, text1) => {
        console.log(`EN: ${text0}`)
        console.log(`ES: ${text1}`)
    }
)
