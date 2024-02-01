import { invariant } from "@epic-web/invariant"
import { type LoaderFunctionArgs } from "@remix-run/node"
import OpenAI from "openai"
import { type ChatCompletionMessageParam } from "openai/resources/index.mjs"
import { eventStream } from "remix-utils/sse/server"
import { authenticator, requireUserId } from "#app/utils/auth.server.ts"
import { prisma } from "#app/utils/db.server.ts"
import { getMatchImgSrc } from "#app/utils/misc"

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { firstName: true },
	})
	if (!user) {
		await authenticator.logout(request, { redirectTo: "/" })
		return new Response(null, { status: 401 })
	}

	const url = new URL(request.url)

	const tone = url.searchParams.get("tone")
	const matchId = url.searchParams.get("matchId")

	const match = await prisma.match.findUnique({
		where: { id: matchId ? matchId : "null" },
		select: {
			images: {
				select: {
					id: true,
				},
			},
		},
	})

	if (!match) {
		return new Response(null, { status: 401 })
	}

	const messages: Array<ChatCompletionMessageParam> | null = [
		{
			role: "system",
			content: `You are an assistant tasked with writing conversation starters and pick up lines. The user will provide an image of the subjects profile that you should use to gauge interests or subjects to reference along with the tone you should use. You will reply with text of a message without quotations or comments.`,
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: `The tone of the message should be ${tone}`,
				},
				{
					type: "image_url",
					image_url: {
						url: getMatchImgSrc(match.images[0].id),
					},
				},
			],
			name: user.firstName,
		},
	]

	invariant(messages, "Must provide title or content")

	const stream = await openai.chat.completions.create({
		model: "gpt-4-vision-preview",
		messages,
		temperature: 0.7,
		max_tokens: 1024,
		stream: true,
	})
	const controller = new AbortController()
	request.signal.addEventListener("abort", () => {
		controller.abort()
	})

	return eventStream(controller.signal, function setup(send) {
		async function handleStream() {
			for await (const part of stream) {
				const delta = part.choices[0].delta?.content?.replace(
					/\n/g,
					"␣",
				)
				if (delta) send({ data: delta })
			}
		}
		handleStream().then(
			() => controller.abort(),
			() => controller.abort(),
		)
		return function clear() {}
	})
}
