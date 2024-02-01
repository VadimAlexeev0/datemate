import {
	conform,
	list,
	useFieldList,
	useFieldset,
	useForm,
	type FieldConfig,
} from "@conform-to/react"
import { getFieldsetConstraint, parse } from "@conform-to/zod"
import { createId as cuid } from "@paralleldrive/cuid2"
import { type Match, type MatchImage } from "@prisma/client"
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
	type SerializeFrom,
} from "@remix-run/node"
import { Form, useActionData } from "@remix-run/react"
import { useRef, useState } from "react"
import { z } from "zod"
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx"
import { ErrorList, Field, TextareaField } from "#app/components/forms.tsx"
import { Button } from "#app/components/ui/button.tsx"
import { Icon } from "#app/components/ui/icon.tsx"
import { Label } from "#app/components/ui/label.tsx"
import { StatusButton } from "#app/components/ui/status-button.tsx"
import { requireUserId } from "#app/utils/auth.server.ts"
import { prisma } from "#app/utils/db.server.ts"
import { cn, getMatchImgSrc, useIsPending } from "#app/utils/misc.tsx"

const titleMinLength = 1
const titleMaxLength = 100
const contentMinLength = 1
const contentMaxLength = 10000

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const ImageFieldsetSchema = z.object({
	id: z.string().optional(),
	file: z
		.instanceof(File)
		.optional()
		.refine(file => {
			return !file || file.size <= MAX_UPLOAD_SIZE
		}, "File size must be less than 3MB"),
})

type ImageFieldset = z.infer<typeof ImageFieldsetSchema>

function imageHasFile(
	image: ImageFieldset,
): image is ImageFieldset & { file: NonNullable<ImageFieldset["file"]> } {
	return Boolean(image.file?.size && image.file?.size > 0)
}

function imageHasId(
	image: ImageFieldset,
): image is ImageFieldset & { id: NonNullable<ImageFieldset["id"]> } {
	return image.id != null
}

const MatchEditorSchema = z.object({
	id: z.string().optional(),
	username: z.string().min(titleMinLength).max(titleMaxLength),
	gender: z.string(),
	description: z
		.string()
		.min(contentMinLength)
		.max(contentMaxLength)
		.optional(),
	images: z.array(ImageFieldsetSchema).max(5).optional(),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)

	const submission = await parse(formData, {
		schema: MatchEditorSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			const match = await prisma.match.findUnique({
				select: { id: true },
				where: { id: data.id, ownerId: userId },
			})
			if (!match) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Match not found",
				})
			}
		}).transform(async ({ images = [], ...data }) => {
			return {
				...data,
				imageUpdates: await Promise.all(
					images.filter(imageHasId).map(async i => {
						if (imageHasFile(i)) {
							return {
								id: i.id,
								contentType: i.file.type,
								blob: Buffer.from(await i.file.arrayBuffer()),
							}
						} else {
							return {
								id: i.id,
							}
						}
					}),
				),
				newImages: await Promise.all(
					images
						.filter(imageHasFile)
						.filter(i => !i.id)
						.map(async image => {
							return {
								contentType: image.file.type,
								blob: Buffer.from(
									await image.file.arrayBuffer(),
								),
							}
						}),
				),
			}
		}),
		async: true,
	})

	if (submission.intent !== "submit") {
		return json({ submission } as const)
	}

	if (!submission.value) {
		return json({ submission } as const, { status: 400 })
	}

	const {
		id: matchId,
		username,
		description,
		gender,
		imageUpdates = [],
		newImages = [],
	} = submission.value

	const updatedMatch = await prisma.match.upsert({
		select: { id: true },
		where: { id: matchId ?? "__new_match__" },
		create: {
			ownerId: userId,
			username,
			description,
			gender,
			images: { create: newImages },
		},
		update: {
			username,
			description,
			gender,
			images: {
				deleteMany: { id: { notIn: imageUpdates.map(i => i.id) } },
				updateMany: imageUpdates.map(updates => ({
					where: { id: updates.id },
					data: {
						...updates,
						id: updates.blob ? cuid() : updates.id,
					},
				})),
				create: newImages,
			},
		},
	})

	return redirect(`/matches/${updatedMatch.id}/chats`)
}

export function MatchEditor({
	match,
}: {
	match?: SerializeFrom<
		Pick<Match, "id" | "username" | "description" | "gender"> & {
			images: Array<Pick<MatchImage, "id">>
		}
	>
}) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: "match-editor",
		constraint: getFieldsetConstraint(MatchEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: MatchEditorSchema })
		},
		defaultValue: {
			username: match?.username ?? "",
			description: match?.description ?? "",
			gender: match?.gender ?? "",
			images: match?.images ?? [],
		},
	})
	const imageList = useFieldList(form.ref, fields.images)

	return (
		<div className="">
			<Form
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28"
				{...form.props}
				encType="multipart/form-data"
			>
				{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
				<button type="submit" className="hidden" />
				{match ? (
					<input type="hidden" name="id" value={match.id} />
				) : null}
				<div className="flex flex-col gap-1">
					<Field
						labelProps={{ children: "Name" }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.username, {
								ariaAttributes: true,
							}),
						}}
						errors={fields.username.errors}
					/>
					<Field
						labelProps={{ children: "Gender" }}
						inputProps={{
							...conform.input(fields.gender, {
								ariaAttributes: true,
							}),
						}}
						errors={fields.gender.errors}
					/>
					<TextareaField
						labelProps={{
							children:
								"Description (optional only used when no images uploaded)",
						}}
						textareaProps={{
							...conform.textarea(fields.description, {
								ariaAttributes: true,
							}),
						}}
						errors={fields.description.errors}
					/>
					<div>
						<Label>Images</Label>
						<ul className="flex flex-col gap-4">
							{imageList.map((image, index) => (
								<li
									key={image.key}
									className="relative border-b-2 border-muted-foreground"
								>
									<button
										className="absolute right-0 top-0 text-foreground-destructive"
										{...list.remove(fields.images.name, {
											index,
										})}
									>
										<span aria-hidden>
											<Icon name="cross-1" />
										</span>{" "}
										<span className="sr-only">
											Remove image {index + 1}
										</span>
									</button>
									<ImageChooser config={image} />
								</li>
							))}
						</ul>
					</div>
					<Button
						className="mt-3"
						{...list.insert(fields.images.name, {
							defaultValue: {},
						})}
					>
						<span aria-hidden>
							<Icon name="plus">Image</Icon>
						</span>{" "}
						<span className="sr-only">Add image</span>
					</Button>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>

			<div className="m-4 flex items-center justify-end gap-2 rounded-lg bg-muted/80 p-4 shadow-xl md:gap-4 md:pl-7">
				<Button form={form.id} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					form={form.id}
					type="submit"
					disabled={isPending}
					status={isPending ? "pending" : "idle"}
				>
					Submit
				</StatusButton>
			</div>
		</div>
	)
}

function ImageChooser({
	config,
}: {
	config: FieldConfig<z.infer<typeof ImageFieldsetSchema>>
}) {
	const ref = useRef<HTMLFieldSetElement>(null)
	const fields = useFieldset(ref, config)
	const existingImage = Boolean(fields.id.defaultValue)
	const [previewImage, setPreviewImage] = useState<string | null>(
		fields.id.defaultValue ? getMatchImgSrc(fields.id.defaultValue) : null,
	)

	return (
		<fieldset
			ref={ref}
			aria-invalid={Boolean(config.errors?.length) || undefined}
			aria-describedby={
				config.errors?.length ? config.errorId : undefined
			}
		>
			<div className="flex gap-3">
				<div className="w-32">
					<div className="relative h-32 w-32">
						<label
							htmlFor={fields.file.id}
							className={cn(
								"group absolute h-32 w-32 rounded-lg",
								{
									"bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100":
										!previewImage,
									"cursor-pointer focus-within:ring-2":
										!existingImage,
								},
							)}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt="Preview of upload"
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{existingImage ? null : (
										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
											new
										</div>
									)}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									<Icon name="plus" />
								</div>
							)}
							{existingImage ? (
								<input
									{...conform.input(fields.id, {
										type: "hidden",
										ariaAttributes: true,
									})}
								/>
							) : null}
							<input
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={event => {
									const file = event.target.files?.[0]

									if (file) {
										const reader = new FileReader()
										reader.onloadend = () => {
											setPreviewImage(
												reader.result as string,
											)
										}
										reader.readAsDataURL(file)
									} else {
										setPreviewImage(null)
									}
								}}
								accept="image/*"
								{...conform.input(fields.file, {
									type: "file",
									ariaAttributes: true,
								})}
							/>
						</label>
					</div>
					<div className="min-h-[32px] px-4 pb-3 pt-1">
						<ErrorList
							id={fields.file.errorId}
							errors={fields.file.errors}
						/>
					</div>
				</div>
				{/* <div className="flex-1">
					<Label htmlFor={fields.altText.id}>Alt Text</Label>
					<Textarea
						onChange={e => setAltText(e.currentTarget.value)}
						{...conform.textarea(fields.altText, { ariaAttributes: true })}
					/>
					<div className="min-h-[32px] px-4 pb-3 pt-1">
						<ErrorList
							id={fields.altText.errorId}
							errors={fields.altText.errors}
						/>
					</div>
				</div> */}
			</div>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				<ErrorList id={config.errorId} errors={config.errors} />
			</div>
		</fieldset>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No match with the id "{params.matchId}" exists</p>
				),
			}}
		/>
	)
}
