import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { z } from "zod";
import FormSelect from "~/components/FormSelect";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { getPublicAthletesDirectory } from "~/public/public.functions";
import {
	DISCIPLINE_META,
	formatDistanceMiles,
	PUBLIC_DISCIPLINES,
	type PublicDiscipline,
} from "~/public/public.shared";

const athletesSearchSchema = z.object({
	q: z.string().optional(),
	discipline: z.enum(PUBLIC_DISCIPLINES).optional(),
});

export const Route = createFileRoute("/athletes/")({
	validateSearch: (search) => athletesSearchSchema.parse(search),
	loader: () => getPublicAthletesDirectory({ data: {} }),
	component: AthletesDirectoryPage,
});

const disciplineOptions = [
	{ value: "all", label: "All disciplines" },
	...PUBLIC_DISCIPLINES.map((d) => ({
		value: d,
		label: DISCIPLINE_META[d].label,
	})),
];

function AthletesDirectoryPage() {
	const data = Route.useLoaderData();
	const search = Route.useSearch();

	const [query, setQuery] = createSignal(search().q ?? "");
	const [discipline, setDiscipline] = createSignal<string>(
		search().discipline ?? "all",
	);

	const filteredAthletes = () => {
		const q = query().trim().toLowerCase();
		const d = discipline();

		return data().athletes.filter((a) => {
			if (d !== "all" && !a.disciplines.includes(d as PublicDiscipline)) {
				return false;
			}
			if (q) {
				const hay = `${a.displayName} ${a.cityState}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Public Directory</p>
			<h1 class="page-title">Athletes</h1>
			<p class="page-sub">
				Search endurance athletes and view lifetime race histories.
			</p>

			<Card class="mb-8 p-5 sm:p-6">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
					<div class="grid gap-2">
						<label
							for="athlete-search-input"
							class="text-sm font-medium text-foreground"
						>
							Search by athlete name or city
						</label>
						<Input
							id="athlete-search-input"
							type="search"
							value={query()}
							onInput={(e) => setQuery(e.currentTarget.value)}
							placeholder="Search by name or city…"
						/>
					</div>

					<FormSelect
						label="Discipline"
						options={disciplineOptions}
						value={discipline()}
						onChange={(v) => setDiscipline(v)}
					/>
				</div>
			</Card>

			<Show
				when={filteredAthletes().length > 0}
				fallback={
					<Card class="p-10 text-center">
						<h2 class="font-display m-0 text-2xl font-normal text-foreground">
							No matching athletes found
						</h2>
						<p class="m-0 mt-2 text-sm text-muted-foreground">
							Adjust your name search or discipline filter.
						</p>
						<div class="mt-4">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setQuery("");
									setDiscipline("all");
								}}
							>
								Reset filters
							</Button>
						</div>
					</Card>
				}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Athlete</TableHead>
							<TableHead>Location</TableHead>
							<TableHead>Finishes</TableHead>
							<TableHead class="text-right">Max Distance</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={filteredAthletes()}>
							{(athlete) => (
								<TableRow>
									<TableCell class="font-semibold">
										<Link
											to="/athletes/$personId"
											params={{ personId: athlete.id }}
											class="text-foreground no-underline hover:text-forest"
										>
											{athlete.displayName}
										</Link>
									</TableCell>
									<TableCell class="text-muted-foreground">
										{athlete.cityState}
									</TableCell>
									<TableCell class="tabular-nums">
										{athlete.totalFinishes} / {athlete.totalRaces}
									</TableCell>
									<TableCell class="text-right tabular-nums">
										{formatDistanceMiles(athlete.maxDistanceMeters)}
									</TableCell>
								</TableRow>
							)}
						</For>
					</TableBody>
				</Table>
			</Show>
		</main>
	);
}
