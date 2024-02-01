import { useForm } from "@conform-to/react"
import { parse } from "@conform-to/zod"
import { invariantResponse } from "@epic-web/invariant"
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from "@remix-run/node"
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	type MetaFunction,
} from "@remix-run/react"
import { formatDistanceToNow } from "date-fns"
import { z } from "zod"
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx"
import { floatingToolbarClassName } from "#app/components/floating-toolbar.tsx"
import { ErrorList } from "#app/components/forms.tsx"
import { Button } from "#app/components/ui/button.tsx"
import { Icon } from "#app/components/ui/icon.tsx"
import { StatusButton } from "#app/components/ui/status-button.tsx"
// import { requireUserId } from "#app/utils/auth.server.ts"
import { prisma } from "#app/utils/db.server.ts"
import { getChatImgSrc, useIsPending } from "#app/utils/misc.tsx"
import { requireUserWithPermission } from "#app/utils/permissions.server.ts"
import { redirectWithToast } from "#app/utils/toast.server.ts"
import { userHasPermission, useOptionalUser } from "#app/utils/user.ts"
import { type loader as notesLoader } from "./chats.tsx"

export async function loader({ params }: LoaderFunctionArgs) {
	const chat = await prisma.chat.findUnique({
		where: { id: params.chatId },
		select: {
			id: true,
			title: true,
			content: true,
			updatedAt: true,
			images: {
				select: {
					id: true,
				},
			},
		},
	})

	invariantResponse(chat, "Not found", { status: 404 })

	const date = new Date(chat.updatedAt)
	const timeAgo = formatDistanceToNow(date)

	return json({
		chat,
		timeAgo,
	})
}

const DeleteFormSchema = z.object({
	intent: z.literal("delete-chat"),
	chatId: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	// const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: DeleteFormSchema,
	})
	if (submission.intent !== "submit") {
		return json({ status: "idle", submission } as const)
	}
	if (!submission.value) {
		return json({ status: "error", submission } as const, { status: 400 })
	}

	const { chatId } = submission.value

	const chat = await prisma.chat.findFirst({
		select: { id: true, matchId: true },
		where: { id: chatId },
	})
	invariantResponse(chat, "Not found", { status: 404 })

	const isOwner = true
	await requireUserWithPermission(
		request,
		isOwner ? `delete:note:own` : `delete:note:any`,
	)

	await prisma.chat.delete({ where: { id: chat.id } })

	return redirectWithToast(`/matches/${chat.matchId}/chats`, {
		type: "success",
		title: "Success",
		description: "Your chat has been deleted.",
	})
}

export default function ChatRoute() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const isOwner = true
	const canDelete = userHasPermission(
		user,
		isOwner ? `delete:note:own` : `delete:note:any`,
	)
	const displayBar = canDelete || isOwner

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">{data.chat.title}</h2>
			<div
				className={`${displayBar ? "pb-24" : "pb-12"} overflow-y-auto`}
			>
				<ul className="flex flex-wrap gap-5 py-5">
					{data.chat.images.map(image => (
						<li key={image.id}>
							<a href={getChatImgSrc(image.id)}>
								<img
									src={getChatImgSrc(image.id)}
									alt="chat"
									className="h-32 w-32 rounded-lg object-cover"
								/>
							</a>
						</li>
					))}
				</ul>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					{data.chat.content}
				</p>
			</div>
			{displayBar ? (
				<div className={floatingToolbarClassName}>
					<span className="text-sm text-foreground/90 max-[524px]:hidden">
						<Icon name="clock" className="scale-125">
							{data.timeAgo} ago
						</Icon>
					</span>
					<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
						{canDelete ? <DeleteChat id={data.chat.id} /> : null}
						<Button
							asChild
							className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0"
						>
							<Link to="edit">
								<Icon
									name="pencil-1"
									className="scale-125 max-md:scale-150"
								>
									<span className="max-md:hidden">Edit</span>
								</Icon>
							</Link>
						</Button>
					</div>
				</div>
			) : null}
		</div>
	)
}

export function DeleteChat({ id }: { id: string }) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [form] = useForm({
		id: "delete-note",
		lastSubmission: actionData?.submission,
	})

	return (
		<Form method="POST" {...form.props}>
			<input type="hidden" name="noteId" value={id} />
			<StatusButton
				type="submit"
				name="intent"
				value="delete-note"
				variant="destructive"
				status={isPending ? "pending" : actionData?.status ?? "idle"}
				disabled={isPending}
				className="w-full max-md:aspect-square max-md:px-0"
			>
				<Icon name="trash" className="scale-125 max-md:scale-150">
					<span className="max-md:hidden">Delete</span>
				</Icon>
			</StatusButton>
			<ErrorList errors={form.errors} id={form.errorId} />
		</Form>
	)
}

export const meta: MetaFunction<
	typeof loader,
	{ "routes/users+/$username_+/notes": typeof notesLoader }
> = ({ data, params, matches }) => {
	const notesMatch = matches.find(
		m => m.id === "routes/users+/$username_+/notes",
	)
	const displayName = notesMatch?.data?.match.username ?? params.username
	const noteTitle = data?.chat.title ?? "Match"
	// const noteContentsSummary =
	// 	data && data!.chat.content.length > 100
	// 		? data?.chat.content.slice(0, 97) + "..."
	// 		: "No content"
	return [
		{ title: `${noteTitle} | ${displayName}'s Notes | Epic Notes` },
		// {
		// 	name: "description",
		// 	content: noteContentsSummary,
		// },
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
