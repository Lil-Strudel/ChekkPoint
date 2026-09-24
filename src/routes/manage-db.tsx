import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { z } from "zod";
import { getCollectionRows } from "../db/manage-db.functions";
import type {
	FetchCollectionResult,
	SerializableValue,
} from "../db/manage-db.server";
import {
	COLLECTION_CATEGORIES,
	COLLECTIONS,
	type CollectionCategory,
	type CollectionMetadata,
	getCollectionById,
	getCollectionsByCategory,
	isCollectionKey,
} from "../db/schema-metadata";

const manageDbSearchSchema = z.object({
	collection: z.string().optional(),
	view: z.enum(["schema", "data"]).optional(),
});

export const Route = createFileRoute("/manage-db")({
	validateSearch: (search) => manageDbSearchSchema.parse(search),
	loaderDeps: ({ search }) => ({
		collection: search.collection,
		view: search.view,
	}),
	loader: async ({ deps }): Promise<FetchCollectionResult | null> => {
		if (
			deps.view === "data" &&
			deps.collection &&
			deps.collection !== "overview" &&
			isCollectionKey(deps.collection)
		) {
			return await getCollectionRows({
				data: { collection: deps.collection, limit: 50 },
			});
		}
		return null;
	},
	component: ManageDbPage,
});

function ManageDbPage() {
	const search = Route.useSearch();
	const loaderData = Route.useLoaderData();
	const router = useRouter();

	const [filterQuery, setFilterQuery] = createSignal("");
	const [refreshing, setRefreshing] = createSignal(false);

	const activeCollectionId = createMemo(
		() => search().collection ?? "overview",
	);
	const activeView = createMemo(() => search().view ?? "schema");

	const selectedCollection = createMemo(() => {
		const id = activeCollectionId();
		if (id === "overview") return null;
		return getCollectionById(id) ?? null;
	});

	const filteredCategories = createMemo(() => {
		const query = filterQuery().trim().toLowerCase();
		const grouped = getCollectionsByCategory();
		if (!query) return grouped;

		const filtered = {} as Record<CollectionCategory, CollectionMetadata[]>;
		for (const cat of COLLECTION_CATEGORIES) {
			filtered[cat] = grouped[cat].filter(
				(col) =>
					col.name.toLowerCase().includes(query) ||
					col.tableName.toLowerCase().includes(query) ||
					col.shortDescription.toLowerCase().includes(query) ||
					col.badge.toLowerCase().includes(query),
			);
		}
		return filtered;
	});

	const totalMatchingCollections = createMemo(() => {
		const groups = filteredCategories();
		return Object.values(groups).reduce((acc, list) => acc + list.length, 0);
	});

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await router.invalidate();
		} finally {
			setTimeout(() => setRefreshing(false), 300);
		}
	};

	return (
		<main class="page-wrap px-4 pb-16 pt-4 sm:pt-6">
			{/* Main Split-Pane Layout */}
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
				{/* Left Sidebar */}
				<aside class="lg:col-span-4 xl:col-span-3 2xl:col-span-2">
					<div class="lg:sticky lg:top-20 space-y-4">
						{/* Search Filter */}
						<div class="island-shell rounded-xl p-3">
							<div class="relative">
								<input
									type="text"
									placeholder="Search collections or tables..."
									value={filterQuery()}
									onInput={(e) => setFilterQuery(e.currentTarget.value)}
									class="demo-input text-xs py-2 pl-3 pr-8"
								/>
								<Show when={filterQuery()}>
									<button
										type="button"
										onClick={() => setFilterQuery("")}
										class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
										title="Clear search"
									>
										✕
									</button>
								</Show>
							</div>
							<div class="mt-2 flex items-center justify-between text-xs text-[var(--sea-ink-soft)] px-1">
								<span>
									Showing {totalMatchingCollections()} of {COLLECTIONS.length}
								</span>
								<Show when={filterQuery()}>
									<span class="font-semibold text-[var(--lagoon-deep)]">
										Filtered
									</span>
								</Show>
							</div>
						</div>

						{/* Overview Button */}
						<Link
							to="/manage-db"
							search={{ collection: "overview", view: "schema" }}
							class={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${
								activeCollectionId() === "overview"
									? "border-[var(--lagoon-deep)] bg-white/95 text-[var(--sea-ink)] shadow-md"
									: "border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink-soft)] hover:bg-white hover:text-[var(--sea-ink)]"
							}`}
						>
							<div class="flex items-center gap-2">
								<span class="text-base">🗺️</span>
								<span>Domain Overview</span>
							</div>
							<span class="demo-pill text-xs py-0 px-2">Map</span>
						</Link>

						{/* Categorized Collection Navigation */}
						<div
							class="space-y-4 max-h-[calc(100vh-18rem)] overflow-y-auto overscroll-contain pr-1"
							style={{ "overscroll-behavior": "contain" }}
						>
							<For each={COLLECTION_CATEGORIES}>
								{(category) => {
									const collections = () => filteredCategories()[category];
									return (
										<Show when={collections().length > 0}>
											<div class="space-y-1.5">
												<div class="flex items-center justify-between px-2 pt-2 text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
													<span>{category}</span>
													<span class="text-[10px] font-mono opacity-70">
														{collections().length}
													</span>
												</div>

												<div class="space-y-1">
													<For each={collections()}>
														{(col) => {
															const isSelected = () =>
																activeCollectionId() === col.id;
															return (
																<Link
																	to="/manage-db"
																	search={{
																		collection: col.id,
																		view: activeView(),
																	}}
																	class={`group flex flex-col p-2.5 rounded-lg border text-left transition-all ${
																		isSelected()
																			? "border-[var(--lagoon-deep)] bg-white/95 text-[var(--sea-ink)] shadow-sm"
																			: "border-transparent bg-white/40 text-[var(--sea-ink-soft)] hover:border-[var(--line)] hover:bg-white/80 hover:text-[var(--sea-ink)]"
																	}`}
																>
																	<div class="flex items-center justify-between gap-1">
																		<span class="text-sm font-bold truncate">
																			{col.name}
																		</span>
																		<span
																			class={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
																				isSelected()
																					? "bg-[rgba(79,184,178,0.2)] text-[var(--lagoon-deep)] font-semibold"
																					: "bg-black/5 text-[var(--sea-ink-soft)]"
																			}`}
																		>
																			{col.badge}
																		</span>
																	</div>
																	<span class="text-xs font-mono text-[var(--sea-ink-soft)] opacity-80 mt-0.5 truncate">
																		{col.tableName}
																	</span>
																</Link>
															);
														}}
													</For>
												</div>
											</div>
										</Show>
									);
								}}
							</For>
						</div>
					</div>
				</aside>

				{/* Right Main Stage */}
				<section class="lg:col-span-8 xl:col-span-9 2xl:col-span-10 space-y-6">
					<Show
						when={selectedCollection()}
						fallback={
							<DomainOverviewView
								onSelectCollection={(id, view) => {
									router.navigate({
										to: "/manage-db",
										search: { collection: id, view },
									});
								}}
							/>
						}
					>
						{(col) => (
							<div class="space-y-6">
								{/* Collection Header Bar */}
								<div class="island-shell rounded-2xl p-6">
									<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
										<div>
											<div class="flex flex-wrap items-center gap-2 mb-2">
												<Link
													to="/manage-db"
													search={{ collection: "overview", view: "schema" }}
													class="text-xs font-semibold text-[var(--lagoon-deep)] hover:underline flex items-center gap-1"
												>
													← Overview
												</Link>
												<span class="text-[var(--line)]">•</span>
												<span class="demo-pill text-xs">{col().category}</span>
												<span class="demo-pill font-mono text-xs font-semibold text-[var(--palm)]">
													{col().badge}
												</span>
											</div>

											<h2 class="text-2xl font-extrabold text-[var(--sea-ink)] flex items-center gap-3">
												<span>{col().name}</span>
												<code class="text-xs font-mono font-normal bg-black/5 px-2 py-1 rounded">
													{col().tableName}
												</code>
											</h2>
											<p class="mt-1 text-sm text-[var(--sea-ink-soft)]">
												{col().shortDescription}
											</p>
										</div>

										{/* View Mode Toggle */}
										<div class="flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 self-start">
											<Link
												to="/manage-db"
												search={{ collection: col().id, view: "schema" }}
												class={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
													activeView() === "schema"
														? "bg-white text-[var(--sea-ink)] shadow-sm"
														: "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
												}`}
											>
												Schema
											</Link>
											<Link
												to="/manage-db"
												search={{ collection: col().id, view: "data" }}
												class={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
													activeView() === "data"
														? "bg-white text-[var(--sea-ink)] shadow-sm"
														: "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
												}`}
											>
												Data
											</Link>
										</div>
									</div>
								</div>

								{/* Conditional View: Schema vs Data */}
								<Show
									when={activeView() === "data"}
									fallback={<CollectionSchemaView collection={col()} />}
								>
									<CollectionDataView
										collection={col()}
										loaderData={loaderData()}
										refreshing={refreshing()}
										onRefresh={handleRefresh}
									/>
								</Show>
							</div>
						)}
					</Show>
				</section>
			</div>
		</main>
	);
}

// ============================================================================
// DOMAIN OVERVIEW SUBVIEW
// ============================================================================

function DomainOverviewView(props: {
	onSelectCollection: (id: string, view: "schema" | "data") => void;
}) {
	return (
		<div class="space-y-6">
			{/* Domain Metrics Grid */}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="island-shell rounded-xl p-4 bg-white/70">
					<span class="block text-xs font-semibold text-[var(--sea-ink-soft)]">
						Domain Collections
					</span>
					<span class="text-2xl font-extrabold text-[var(--sea-ink)]">
						{COLLECTIONS.length}
					</span>
				</div>
				<div class="island-shell rounded-xl p-4 bg-white/70">
					<span class="block text-xs font-semibold text-[var(--sea-ink-soft)]">
						Architectural Categories
					</span>
					<span class="text-2xl font-extrabold text-[var(--sea-ink)]">
						{COLLECTION_CATEGORIES.length}
					</span>
				</div>
				<div class="island-shell rounded-xl p-4 bg-white/70">
					<span class="block text-xs font-semibold text-[var(--sea-ink-soft)]">
						Write Plane Ledger
					</span>
					<span class="text-2xl font-extrabold text-[var(--palm)]">
						1 (Immutable)
					</span>
				</div>
				<div class="island-shell rounded-xl p-4 bg-white/70">
					<span class="block text-xs font-semibold text-[var(--sea-ink-soft)]">
						Read Projections
					</span>
					<span class="text-2xl font-extrabold text-[var(--lagoon-deep)]">
						1 (Standings)
					</span>
				</div>
			</div>

			{/* Architectural CQRS Pipeline Visualizer */}
			<section class="island-shell rounded-2xl p-6 sm:p-8">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-bold text-[var(--sea-ink)] flex items-center gap-2">
						<span>⚡</span>
						<span>High-Performance Timing Domain Pipeline</span>
					</h3>
					<span class="demo-pill text-xs">CQRS Architecture</span>
				</div>

				<p class="text-sm text-[var(--sea-ink-soft)] mb-6 max-w-5xl">
					ChekkPoint cleanly separates continuous high-throughput hardware pulse
					ingestion (<strong>Write Plane</strong>) from calculated checkpoint
					leaderboards and split projections (<strong>Read Plane</strong>),
					governed by strict audit controls and multi-tenant hierarchies.
				</p>

				{/* Pipeline Diagram Cards */}
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
					<div class="demo-card bg-white/70 border-l-4 border-l-[var(--palm)]">
						<span class="text-xs font-bold uppercase tracking-wider text-[var(--palm)]">
							1. Configuration & Roster
						</span>
						<h4 class="text-base font-extrabold text-[var(--sea-ink)] mt-1">
							Hierarchy & Courses
						</h4>
						<p class="text-xs text-[var(--sea-ink-soft)] mt-1">
							Organizations host EventGroups containing Events. Courses map
							physical TimingPoints to logical CourseSplits. People register as
							Entrants.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<span class="demo-pill text-[10px] py-0 px-1.5">
								organizations
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">eventGroups</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">courses</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">people</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">entrants</span>
						</div>
					</div>

					<div class="demo-card bg-white/70 border-l-4 border-l-[var(--lagoon-deep)]">
						<span class="text-xs font-bold uppercase tracking-wider text-[var(--lagoon-deep)]">
							2. Write Plane (Audit Ledger)
						</span>
						<h4 class="text-base font-extrabold text-[var(--sea-ink)] mt-1">
							Immutable UTC Pulses
						</h4>
						<p class="text-xs text-[var(--sea-ink-soft)] mt-1">
							RFID mats, lasers, ham radios, and offline PWAs append raw pulses.
							Zero updates or deletes. Replaces loose boolean flags with
							single-status validation.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<span class="demo-pill text-[10px] py-0 px-1.5 font-bold text-[var(--lagoon-deep)]">
								rawTimingEvents
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">
								timingPoints
							</span>
						</div>
					</div>

					<div class="demo-card bg-white/70 border-l-4 border-l-amber-600">
						<span class="text-xs font-bold uppercase tracking-wider text-amber-700">
							3. Read Plane & Operations
						</span>
						<h4 class="text-base font-extrabold text-[var(--sea-ink)] mt-1">
							Materialized Standings
						</h4>
						<p class="text-xs text-[var(--sea-ink-soft)] mt-1">
							Scoring workers project elapsed times, dwell seconds, and TSD
							penalties. Time allowances extend cutoffs; audits record every
							manual steward change.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<span class="demo-pill text-[10px] py-0 px-1.5 font-bold text-amber-800">
								scoredSplitTimes
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">
								timeAllowances
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">
								splitTimeAudits
							</span>
						</div>
					</div>

					<div class="demo-card bg-white/70 border-l-4 border-l-purple-600">
						<span class="text-xs font-bold uppercase tracking-wider text-purple-700">
							4. Competitor History & Projections
						</span>
						<h4 class="text-base font-extrabold text-[var(--sea-ink)] mt-1">
							Athletic Intelligence & SAR
						</h4>
						<p class="text-xs text-[var(--sea-ink-soft)] mt-1">
							Multi-source scraping (UltraSignup, Strava, DUV, ITRA) with MFDA
							disambiguation. Pacing models predict split arrival windows and
							flag SAR/cutoff risks.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<span class="demo-pill text-[10px] py-0 px-1.5 font-bold text-purple-800">
								personExternalProfiles
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5 font-bold text-purple-800">
								personRaceHistory
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">
								personHistoricalSummaries
							</span>
							<span class="demo-pill text-[10px] py-0 px-1.5">
								entrantHistoricalProjections
							</span>
						</div>
					</div>
				</div>
			</section>

			{/* Collection Directory Cards */}
			<section class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-bold text-[var(--sea-ink)]">
						All Domain Collections ({COLLECTIONS.length})
					</h3>
					<span class="text-xs text-[var(--sea-ink-soft)]">
						Click to inspect schema specification or live records
					</span>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
					<For each={COLLECTIONS}>
						{(col) => (
							<div class="demo-card content-visibility-auto flex flex-col justify-between hover:border-[var(--lagoon-deep)] transition-all bg-white/60">
								<div>
									<div class="flex items-center justify-between gap-2 mb-2">
										<span class="demo-pill text-[10px] py-0.5">
											{col.category}
										</span>
										<span class="text-xs font-mono font-semibold text-[var(--lagoon-deep)]">
											{col.badge}
										</span>
									</div>

									<h4 class="text-base font-bold text-[var(--sea-ink)] flex items-center justify-between">
										<span>{col.name}</span>
										<code class="text-xs font-mono font-normal text-[var(--sea-ink-soft)]">
											{col.tableName}
										</code>
									</h4>

									<p class="mt-1.5 text-xs text-[var(--sea-ink-soft)] line-clamp-2">
										{col.shortDescription}
									</p>

									<div class="mt-3 flex flex-wrap gap-1">
										<For each={col.fields.slice(0, 5)}>
											{(f) => (
												<span class="text-[10px] font-mono bg-black/5 text-[var(--sea-ink)] px-1.5 py-0.5 rounded">
													{f.name}
												</span>
											)}
										</For>
										<Show when={col.fields.length > 5}>
											<span class="text-[10px] font-mono text-[var(--sea-ink-soft)] self-center px-1">
												+{col.fields.length - 5} more
											</span>
										</Show>
									</div>
								</div>

								<div class="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
									<button
										type="button"
										onClick={() => props.onSelectCollection(col.id, "schema")}
										class="demo-button text-xs py-1.5 px-3 flex-1"
									>
										Schema
									</button>
									<button
										type="button"
										onClick={() => props.onSelectCollection(col.id, "data")}
										class="demo-button demo-button-secondary text-xs py-1.5 px-3 flex-1"
									>
										Data
									</button>
								</div>
							</div>
						)}
					</For>
				</div>
			</section>
		</div>
	);
}

// ============================================================================
// SCHEMA SPECIFICATION SUBVIEW
// ============================================================================

function CollectionSchemaView(props: { collection: CollectionMetadata }) {
	return (
		<div class="space-y-6">
			{/* Operational Purpose Narrative Callout */}
			<section class="demo-alert rounded-xl">
				<div class="flex items-start gap-3">
					<span class="text-xl">💡</span>
					<div>
						<h4 class="text-sm font-bold text-[var(--sea-ink)] uppercase tracking-wide">
							Operational Purpose & Edge Invariants
						</h4>
						<p class="mt-1 text-sm text-[var(--sea-ink)] leading-relaxed">
							{props.collection.operationalPurpose}
						</p>
					</div>
				</div>
			</section>

			{/* Relational Query Graph */}
			<Show when={props.collection.relationships.length > 0}>
				<section class="island-shell rounded-xl p-5">
					<h3 class="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-3">
						Relational Connections ({props.collection.relationships.length})
					</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<For each={props.collection.relationships}>
							{(rel) => (
								<Link
									to="/manage-db"
									search={{
										collection: rel.targetCollectionId,
										view: "schema",
									}}
									class="demo-card bg-white/70 hover:border-[var(--lagoon-deep)] transition-all flex flex-col justify-between"
								>
									<div>
										<div class="flex items-center justify-between mb-1">
											<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--sand)] text-[var(--palm)]">
												{rel.kind === "belongsTo"
													? "↑ Belongs To"
													: "↓ Has Many"}
											</span>
											<span class="text-xs font-mono text-[var(--sea-ink-soft)]">
												{rel.foreignKey}
											</span>
										</div>
										<span class="text-sm font-extrabold text-[var(--sea-ink)] hover:text-[var(--lagoon-deep)]">
											{rel.targetCollectionId} →
										</span>
										<p class="text-xs text-[var(--sea-ink-soft)] mt-1">
											{rel.description}
										</p>
									</div>
								</Link>
							)}
						</For>
					</div>
				</section>
			</Show>

			{/* Documented Fields & Columns Table */}
			<section class="island-shell rounded-xl p-5">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
						Table Columns & Types ({props.collection.fields.length})
					</h3>
					<span class="demo-pill text-xs font-mono">
						{props.collection.tableName}
					</span>
				</div>

				<div class="demo-table-shell">
					<table class="demo-table">
						<thead>
							<tr>
								<th>Column</th>
								<th>PostgreSQL Type</th>
								<th>Constraints</th>
								<th>Default</th>
								<th>Documentation</th>
							</tr>
						</thead>
						<tbody>
							<For each={props.collection.fields}>
								{(f) => (
									<tr>
										<td class="font-mono text-xs font-bold text-[var(--sea-ink)]">
											{f.name}
										</td>
										<td class="font-mono text-xs text-[var(--lagoon-deep)]">
											{f.type}
										</td>
										<td>
											<div class="flex flex-wrap gap-1">
												<Show
													when={!f.nullable}
													fallback={
														<span class="text-[10px] text-gray-500 font-mono">
															nullable
														</span>
													}
												>
													<span class="demo-pill text-[10px] py-0 px-1 bg-red-50 text-red-700 border-red-200">
														NOT NULL
													</span>
												</Show>
												<For each={f.constraints ?? []}>
													{(c) => (
														<span class="demo-pill text-[10px] py-0 px-1 font-semibold">
															{c}
														</span>
													)}
												</For>
											</div>
										</td>
										<td class="font-mono text-xs text-[var(--sea-ink-soft)]">
											{f.defaultValue ?? "—"}
										</td>
										<td class="text-xs text-[var(--sea-ink)]">
											{f.description}
										</td>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</div>
			</section>

			{/* Enums Catalog */}
			<Show when={props.collection.enums && props.collection.enums.length > 0}>
				<section class="island-shell rounded-xl p-5">
					<h3 class="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-3">
						PostgreSQL Enums ({props.collection.enums?.length})
					</h3>
					<div class="space-y-4">
						<For each={props.collection.enums}>
							{(e) => (
								<div class="demo-card bg-white/70">
									<h4 class="text-sm font-mono font-bold text-[var(--lagoon-deep)] mb-2">
										enum "{e.name}"
									</h4>
									<div class="demo-table-shell">
										<table class="demo-table">
											<thead>
												<tr>
													<th>Value</th>
													<th>Label</th>
													<th>Domain Meaning</th>
												</tr>
											</thead>
											<tbody>
												<For each={e.values}>
													{(val) => (
														<tr>
															<td class="font-mono text-xs font-bold text-[var(--sea-ink)]">
																'{val.value}'
															</td>
															<td class="text-xs font-semibold text-[var(--sea-ink)]">
																{val.label}
															</td>
															<td class="text-xs text-[var(--sea-ink-soft)]">
																{val.description}
															</td>
														</tr>
													)}
												</For>
											</tbody>
										</table>
									</div>
								</div>
							)}
						</For>
					</div>
				</section>
			</Show>

			{/* Polymorphic JSONB Schemas */}
			<Show
				when={
					props.collection.polymorphicSchemas &&
					props.collection.polymorphicSchemas.length > 0
				}
			>
				<section class="island-shell rounded-xl p-5">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
							Polymorphic JSONB Schemas
						</h3>
						<span class="demo-pill text-xs">Zod Discriminated Unions</span>
					</div>

					<div class="space-y-4">
						<For each={props.collection.polymorphicSchemas}>
							{(poly) => (
								<div class="demo-card bg-white/70">
									<div class="mb-2">
										<h4 class="text-sm font-bold text-[var(--sea-ink)]">
											{poly.name}
										</h4>
										<p class="text-xs text-[var(--sea-ink-soft)]">
											{poly.description}
										</p>
									</div>

									<div class="demo-table-shell">
										<table class="demo-table">
											<thead>
												<tr>
													<th>Field</th>
													<th>Type</th>
													<th>Description</th>
												</tr>
											</thead>
											<tbody>
												<For each={poly.fields}>
													{(f) => (
														<tr>
															<td class="font-mono text-xs font-bold text-[var(--sea-ink)]">
																{f.name}
															</td>
															<td class="font-mono text-xs text-[var(--lagoon-deep)]">
																{f.type}
															</td>
															<td class="text-xs text-[var(--sea-ink-soft)]">
																{f.description}
															</td>
														</tr>
													)}
												</For>
											</tbody>
										</table>
									</div>
								</div>
							)}
						</For>
					</div>
				</section>
			</Show>

			{/* Database Indexes & Invariants */}
			<Show
				when={props.collection.indexes && props.collection.indexes.length > 0}
			>
				<section class="island-shell rounded-xl p-5">
					<h3 class="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-3">
						Database Indexes ({props.collection.indexes.length})
					</h3>
					<div class="demo-table-shell">
						<table class="demo-table">
							<thead>
								<tr>
									<th>Index Name</th>
									<th>Columns</th>
									<th>Type</th>
									<th>Query Performance Rationale</th>
								</tr>
							</thead>
							<tbody>
								<For each={props.collection.indexes}>
									{(idx) => (
										<tr>
											<td class="font-mono text-xs font-bold text-[var(--sea-ink)]">
												{idx.name}
											</td>
											<td class="font-mono text-xs text-[var(--lagoon-deep)]">
												({idx.columns.join(", ")})
											</td>
											<td>
												<span
													class={`demo-pill text-[10px] py-0 px-1.5 ${
														idx.unique
															? "bg-amber-100 text-amber-800 font-bold"
															: "bg-gray-100 text-gray-700"
													}`}
												>
													{idx.unique ? "UNIQUE" : "INDEX"}
												</span>
											</td>
											<td class="text-xs text-[var(--sea-ink-soft)]">
												{idx.rationale}
											</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					</div>
				</section>
			</Show>
		</div>
	);
}

// ============================================================================
// LIVE DATA SPREADSHEET SUBVIEW
// ============================================================================

function CollectionDataView(props: {
	collection: CollectionMetadata;
	loaderData: FetchCollectionResult | null;
	refreshing: boolean;
	onRefresh: () => void;
}) {
	const rows = createMemo(() => props.loaderData?.rows ?? []);
	const totalCount = createMemo(() => props.loaderData?.totalCount ?? 0);
	const error = createMemo(() => props.loaderData?.error);
	const isOffline = createMemo(() => props.loaderData?.isOffline ?? false);

	const columnKeys = createMemo(() => {
		const currentRows = rows();
		if (currentRows.length > 0) {
			return Object.keys(currentRows[0]);
		}
		return props.collection.fields.map((f) => f.name);
	});

	return (
		<div class="space-y-4">
			{/* Controls Bar */}
			<div class="island-shell rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class="text-sm font-bold text-[var(--sea-ink)]">
						Records in{" "}
						<code class="font-mono">{props.collection.tableName}</code>:
					</span>
					<span class="demo-pill font-mono font-bold text-xs bg-[var(--lagoon)] text-white">
						{totalCount()} row{totalCount() === 1 ? "" : "s"}
					</span>
					<span class="text-xs text-[var(--sea-ink-soft)]">
						(Showing up to 50 most recent records)
					</span>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={props.onRefresh}
						disabled={props.refreshing}
						class="demo-button text-xs py-1.5 px-3 flex items-center gap-1.5"
					>
						<span class={props.refreshing ? "animate-spin" : ""}>🔄</span>
						<span>
							{props.refreshing ? "Refreshing..." : "Refresh Live Data"}
						</span>
					</button>
				</div>
			</div>

			{/* Database Offline or Query Error Banner */}
			<Show when={error()}>
				<div class="demo-alert demo-alert-danger rounded-xl p-4">
					<div class="flex items-start gap-3">
						<span class="text-xl">⚠️</span>
						<div class="space-y-1">
							<h4 class="text-sm font-bold text-red-900">
								{isOffline()
									? "PostgreSQL Database Offline or Unreachable"
									: "Query Execution Error"}
							</h4>
							<p class="text-xs font-mono text-red-800 bg-red-50 p-2 rounded border border-red-200">
								{error()}
							</p>
							<Show when={isOffline()}>
								<p class="text-xs text-red-900 mt-2">
									💡 Start local development services by running:{" "}
									<code class="font-mono bg-white/70 px-1 py-0.5 rounded font-bold">
										pnpm services:up
									</code>{" "}
									or{" "}
									<code class="font-mono bg-white/70 px-1 py-0.5 rounded font-bold">
										docker compose up -d
									</code>
									.
								</p>
							</Show>
						</div>
					</div>
				</div>
			</Show>

			{/* Data Spreadsheet Table */}
			<Show
				when={rows().length > 0}
				fallback={
					<Show when={!error()}>
						<div class="island-shell rounded-xl p-12 text-center">
							<span class="text-3xl">📭</span>
							<h4 class="text-base font-bold text-[var(--sea-ink)] mt-2">
								No Records in Table
							</h4>
							<p class="text-sm text-[var(--sea-ink-soft)] mt-1 max-w-md mx-auto">
								The <code class="font-mono">{props.collection.tableName}</code>{" "}
								table has zero rows recorded so far. Rows will appear here as
								races are configured or timing pulses are ingested.
							</p>
						</div>
					</Show>
				}
			>
				<div class="demo-table-shell max-h-[600px] overflow-auto">
					<table class="demo-table text-xs">
						<thead>
							<tr>
								<th class="w-12 text-center text-[var(--sea-ink-soft)]">#</th>
								<For each={columnKeys()}>
									{(key) => <th class="whitespace-nowrap font-mono">{key}</th>}
								</For>
							</tr>
						</thead>
						<tbody>
							<For each={rows()}>
								{(row, idx) => (
									<tr>
										<td class="text-center font-mono text-[10px] text-[var(--sea-ink-soft)] opacity-60">
											{idx() + 1}
										</td>
										<For each={columnKeys()}>
											{(colKey) => (
												<td class="max-w-[420px] truncate align-top py-2">
													<CellValue value={row[colKey]} />
												</td>
											)}
										</For>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</div>
			</Show>
		</div>
	);
}

// ============================================================================
// CELL VALUE FORMATTER
// ============================================================================

function CellValue(props: { value: SerializableValue }) {
	const [expanded, setExpanded] = createSignal(false);

	if (props.value === null || props.value === undefined) {
		return <span class="font-mono text-gray-400 italic">null</span>;
	}

	if (typeof props.value === "boolean") {
		return (
			<span
				class={`demo-pill text-[10px] py-0 px-1 font-bold ${
					props.value
						? "bg-emerald-100 text-emerald-800"
						: "bg-rose-100 text-rose-800"
				}`}
			>
				{props.value ? "TRUE" : "FALSE"}
			</span>
		);
	}

	if (typeof props.value === "number") {
		return (
			<span class="font-mono font-semibold text-[var(--sea-ink)]">
				{props.value}
			</span>
		);
	}

	if (typeof props.value === "string") {
		// Check for UUID
		const isUuid =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				props.value,
			);
		if (isUuid) {
			return (
				<span
					class="font-mono text-[11px] text-[var(--sea-ink-soft)]"
					title={props.value}
				>
					{props.value.slice(0, 8)}…{props.value.slice(-4)}
				</span>
			);
		}

		// Check for ISO Date
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(props.value)) {
			const formatted = new Date(props.value).toLocaleString();
			return (
				<span
					class="font-mono text-[11px] text-[var(--sea-ink)]"
					title={props.value}
				>
					{formatted}
				</span>
			);
		}

		return <span>{props.value}</span>;
	}

	// JSON Object or Array
	return (
		<div class="relative">
			<button
				type="button"
				onClick={() => setExpanded(!expanded())}
				class="text-[10px] font-mono bg-black/5 hover:bg-black/10 px-1.5 py-0.5 rounded text-[var(--lagoon-deep)] font-semibold flex items-center gap-1"
			>
				<span>
					{Array.isArray(props.value) ? `[${props.value.length}]` : "{…}"}
				</span>
				<span>{expanded() ? "▲" : "▼"}</span>
			</button>
			<Show when={expanded()}>
				{(_) => (
					<pre class="mt-1.5 p-2 rounded bg-slate-900 text-slate-100 text-[10px] font-mono overflow-auto max-h-40 max-w-xs z-10 shadow-lg">
						{JSON.stringify(props.value, null, 2)}
					</pre>
				)}
			</Show>
		</div>
	);
}
