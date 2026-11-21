-- Baseline: the live database as it was on 21 Nov 2026 (schema only, no data).
-- Already applied in production; recorded as applied, so it never runs there.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 19.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: generate_next_sku(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."generate_next_sku"("sku_prefix" character varying) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  next_num int;
begin
  insert into sku_sequences (prefix, last_number)
  values (sku_prefix, 1)
  on conflict (prefix) do update
    set last_number = sku_sequences.last_number + 1
  returning last_number into next_num;
  return sku_prefix || to_char(next_num, 'FM000');
end;
$$;


--
-- Name: rollover_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rollover_tasks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Roll over overdue 'todo' tasks to today
  UPDATE public.tasks
  SET scheduled_date = current_date
  WHERE scheduled_date < current_date
    AND status = 'todo';

  -- Automatically delete videos that are fully 'uploaded' (archiving them)
  DELETE FROM public.videos
  WHERE stage = 'uploaded';
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: analytics_monthly_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."analytics_monthly_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month" "text" NOT NULL,
    "month_label" "text" NOT NULL,
    "revenue" numeric DEFAULT 0,
    "cogs" numeric DEFAULT 0,
    "gross_profit" numeric DEFAULT 0,
    "gross_margin" numeric DEFAULT 0,
    "items_sold" integer DEFAULT 0,
    "average_sale_price" numeric DEFAULT 0,
    "average_profit_per_item" numeric DEFAULT 0,
    "total_hours" numeric DEFAULT 0,
    "profit_per_hour" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sales_details" "jsonb",
    "pdf_emailed_at" timestamp with time zone,
    "items_in_stock" integer,
    "inventory_cost" numeric,
    "return_on_cost" numeric,
    "expected_revenue" numeric,
    "expected_profit" numeric,
    "selling_costs" numeric,
    "time_breakdown" "jsonb"
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" time without time zone,
    "context" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "description" "text",
    "domain" "text" DEFAULT 'WORK'::"text",
    "tag_id" "uuid",
    CONSTRAINT "events_context_check" CHECK (("context" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text", 'Reselling'::"text", 'Drink idea'::"text"])))
);

ALTER TABLE ONLY "public"."events" REPLICA IDENTITY FULL;


--
-- Name: folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "context" "text" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "folders_context_check" CHECK (("context" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text", 'Reselling'::"text", 'Drink idea'::"text"])))
);


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "context" "text" NOT NULL,
    "year" integer NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."goals" REPLICA IDENTITY FULL;


--
-- Name: monthly_takes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."monthly_takes" (
    "month" "text" NOT NULL,
    "facts" "jsonb" NOT NULL,
    "written" "jsonb",
    "raw" "jsonb",
    "attempts" integer,
    "failure" "text",
    "model" "text",
    "emailed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: sku_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."sku_sequences" (
    "prefix" character varying(10) NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL
);


--
-- Name: study_deadlines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."study_deadlines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person" "text" NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "opens_on" "date",
    "cutoff_on" "date" NOT NULL,
    "cutoff_time" time without time zone,
    "done" boolean DEFAULT false NOT NULL,
    "score" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "progress_mode" "text",
    "progress_done" integer,
    "progress_total" integer,
    "progress_pct" integer,
    CONSTRAINT "study_deadlines_person_check" CHECK (("person" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text"]))),
    CONSTRAINT "study_deadlines_progress_mode_check" CHECK (("progress_mode" = ANY (ARRAY['parts'::"text", 'percent'::"text"])))
);


--
-- Name: study_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."study_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person" "text" NOT NULL,
    "module_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "unit" "text",
    "total" integer,
    "current" integer DEFAULT 0 NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "finish_by" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "study_materials_person_check" CHECK (("person" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text"])))
);


--
-- Name: study_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."study_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "kind" "text" DEFAULT 'course'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "study_modules_kind_check" CHECK (("kind" = ANY (ARRAY['course'::"text", 'self'::"text"]))),
    CONSTRAINT "study_modules_person_check" CHECK (("person" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text"])))
);


--
-- Name: study_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."study_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person" "text" NOT NULL,
    "module_id" "uuid",
    "kind" "text" DEFAULT 'general'::"text" NOT NULL,
    "material_id" "uuid",
    "deadline_id" "uuid",
    "started_at" timestamp with time zone NOT NULL,
    "ended_at" timestamp with time zone,
    "timer_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text",
    "task_id" "uuid",
    "paused_at" timestamp with time zone,
    "paused_seconds" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "study_sessions_kind_check" CHECK (("kind" = ANY (ARRAY['general'::"text", 'material'::"text", 'deadline'::"text", 'revision'::"text", 'practice'::"text", 'other'::"text"]))),
    CONSTRAINT "study_sessions_person_check" CHECK (("person" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text"])))
);


--
-- Name: study_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."study_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "context" "text" NOT NULL,
    "tag" "text" NOT NULL,
    "color" "text" NOT NULL,
    "repetition" integer DEFAULT 0,
    "interval" integer DEFAULT 1,
    "ease_factor" real DEFAULT 2.5,
    "next_review_date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."study_topics" REPLICA IDENTITY FULL;


--
-- Name: study_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."study_tracks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person" "text" NOT NULL,
    "video_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "study_tracks_person_check" CHECK (("person" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text"])))
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "domain" "text" DEFAULT 'WORK'::"text" NOT NULL,
    "person" "text",
    CONSTRAINT "tags_domain_check" CHECK (("domain" = ANY (ARRAY['WORK'::"text", 'STUDY'::"text"])))
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "context" "text" NOT NULL,
    "scheduled_date" "date",
    "due_date" "date",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "folder_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "project" "text",
    "is_daily" boolean DEFAULT false,
    "domain" "text" DEFAULT 'WORK'::"text",
    "color" "text",
    "track_progress" boolean DEFAULT false,
    "progress" integer DEFAULT 0,
    "is_joint" boolean DEFAULT false,
    "tag_id" "uuid",
    "time_limit_minutes" integer,
    "time_spent_seconds" integer DEFAULT 0 NOT NULL,
    "pinned" boolean DEFAULT false NOT NULL,
    "in_progress" boolean DEFAULT false NOT NULL,
    CONSTRAINT "tasks_context_check" CHECK (("context" = ANY (ARRAY['Eryk'::"text", 'Alex'::"text", 'Reselling'::"text", 'Drink idea'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'done'::"text"])))
);

ALTER TABLE ONLY "public"."tasks" REPLICA IDENTITY FULL;


--
-- Name: work_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."work_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "person" "text" NOT NULL,
    "task" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration" integer,
    "no_times" boolean DEFAULT false NOT NULL,
    "note" "text",
    "paused_at" timestamp with time zone,
    "paused_seconds" integer DEFAULT 0 NOT NULL
);


--
-- Name: analytics_monthly_snapshots analytics_monthly_snapshots_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."analytics_monthly_snapshots"
    ADD CONSTRAINT "analytics_monthly_snapshots_month_key" UNIQUE ("month");


--
-- Name: analytics_monthly_snapshots analytics_monthly_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."analytics_monthly_snapshots"
    ADD CONSTRAINT "analytics_monthly_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");


--
-- Name: monthly_takes monthly_takes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."monthly_takes"
    ADD CONSTRAINT "monthly_takes_pkey" PRIMARY KEY ("month");


--
-- Name: sku_sequences sku_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sku_sequences"
    ADD CONSTRAINT "sku_sequences_pkey" PRIMARY KEY ("prefix");


--
-- Name: study_deadlines study_deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_deadlines"
    ADD CONSTRAINT "study_deadlines_pkey" PRIMARY KEY ("id");


--
-- Name: study_materials study_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_materials"
    ADD CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id");


--
-- Name: study_modules study_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_modules"
    ADD CONSTRAINT "study_modules_pkey" PRIMARY KEY ("id");


--
-- Name: study_sessions study_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: study_topics study_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_topics"
    ADD CONSTRAINT "study_topics_pkey" PRIMARY KEY ("id");


--
-- Name: study_tracks study_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_tracks"
    ADD CONSTRAINT "study_tracks_pkey" PRIMARY KEY ("id");


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");


--
-- Name: work_sessions work_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."work_sessions"
    ADD CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: events events_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;


--
-- Name: study_deadlines study_deadlines_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_deadlines"
    ADD CONSTRAINT "study_deadlines_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."study_modules"("id") ON DELETE CASCADE;


--
-- Name: study_materials study_materials_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_materials"
    ADD CONSTRAINT "study_materials_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."study_modules"("id") ON DELETE CASCADE;


--
-- Name: study_sessions study_sessions_deadline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "public"."study_deadlines"("id") ON DELETE SET NULL;


--
-- Name: study_sessions study_sessions_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."study_materials"("id") ON DELETE SET NULL;


--
-- Name: study_sessions study_sessions_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."study_modules"("id") ON DELETE CASCADE;


--
-- Name: study_sessions study_sessions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."study_sessions"
    ADD CONSTRAINT "study_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;


--
-- Name: tasks tasks_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE SET NULL;


--
-- Name: tasks tasks_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;


--
-- Name: tasks tasks_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;


--
-- Name: events Enable read access for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all" ON "public"."events" FOR SELECT USING (true);


--
-- Name: goals Enable read access for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all" ON "public"."goals" FOR SELECT USING (true);


--
-- Name: tasks Enable read access for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all" ON "public"."tasks" FOR SELECT USING (true);


--
-- Name: study_topics Enable read access for all on study_topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all on study_topics" ON "public"."study_topics" FOR SELECT USING (true);


--
-- Name: events Enable write access for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable write access for all" ON "public"."events" USING (true);


--
-- Name: goals Enable write access for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable write access for all" ON "public"."goals" USING (true);


--
-- Name: tasks Enable write access for all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable write access for all" ON "public"."tasks" USING (true);


--
-- Name: study_topics Enable write access for all on study_topics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable write access for all on study_topics" ON "public"."study_topics" USING (true);


--
-- Name: work_sessions Eryk and Alex can manage work sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Eryk and Alex can manage work sessions" ON "public"."work_sessions" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['erykpawluk@gmail.com'::"text", 'alexandra.ap.archive@gmail.com'::"text"]))) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = ANY (ARRAY['erykpawluk@gmail.com'::"text", 'alexandra.ap.archive@gmail.com'::"text"])));


--
-- Name: events Private Study Events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Private Study Events" ON "public"."events" USING ((("context" <> ALL (ARRAY['Reselling'::"text", 'Drink idea'::"text"])) AND ("user_id" = "auth"."uid"())));


--
-- Name: folders Private Study Folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Private Study Folders" ON "public"."folders" USING ((("context" <> ALL (ARRAY['Reselling'::"text", 'Drink idea'::"text"])) AND ("user_id" = "auth"."uid"())));


--
-- Name: goals Private Study Goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Private Study Goals" ON "public"."goals" USING ((("context" <> ALL (ARRAY['Reselling'::"text", 'Drink idea'::"text"])) AND ("user_id" = "auth"."uid"())));


--
-- Name: tasks Private Study Tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Private Study Tasks" ON "public"."tasks" USING ((("context" <> ALL (ARRAY['Reselling'::"text", 'Drink idea'::"text"])) AND ("user_id" = "auth"."uid"())));


--
-- Name: events Shared Work Events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared Work Events" ON "public"."events" USING (("context" = ANY (ARRAY['Reselling'::"text", 'Drink idea'::"text"])));


--
-- Name: folders Shared Work Folders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared Work Folders" ON "public"."folders" USING (("context" = ANY (ARRAY['Reselling'::"text", 'Drink idea'::"text"])));


--
-- Name: goals Shared Work Goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared Work Goals" ON "public"."goals" USING (("context" = ANY (ARRAY['Reselling'::"text", 'Drink idea'::"text"])));


--
-- Name: tasks Shared Work Tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Shared Work Tasks" ON "public"."tasks" USING (("context" = ANY (ARRAY['Reselling'::"text", 'Drink idea'::"text"])));


--
-- Name: study_deadlines Signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users" ON "public"."study_deadlines" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: study_materials Signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users" ON "public"."study_materials" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: study_modules Signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users" ON "public"."study_modules" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: study_sessions Signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users" ON "public"."study_sessions" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: study_tracks Signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users" ON "public"."study_tracks" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: tags Signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users" ON "public"."tags" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: analytics_monthly_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."analytics_monthly_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_monthly_snapshots authenticated can read snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read snapshots" ON "public"."analytics_monthly_snapshots" FOR SELECT TO "authenticated" USING (true);


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;

--
-- Name: folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;

--
-- Name: goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_takes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."monthly_takes" ENABLE ROW LEVEL SECURITY;

--
-- Name: sku_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sku_sequences" ENABLE ROW LEVEL SECURITY;

--
-- Name: study_deadlines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."study_deadlines" ENABLE ROW LEVEL SECURITY;

--
-- Name: study_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."study_materials" ENABLE ROW LEVEL SECURITY;

--
-- Name: study_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."study_modules" ENABLE ROW LEVEL SECURITY;

--
-- Name: study_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."study_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: study_topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."study_topics" ENABLE ROW LEVEL SECURITY;

--
-- Name: study_tracks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."study_tracks" ENABLE ROW LEVEL SECURITY;

--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;

--
-- Name: work_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."work_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "generate_next_sku"("sku_prefix" character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."generate_next_sku"("sku_prefix" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_next_sku"("sku_prefix" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_next_sku"("sku_prefix" character varying) TO "service_role";


--
-- Name: FUNCTION "rollover_tasks"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."rollover_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollover_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollover_tasks"() TO "service_role";


--
-- Name: TABLE "analytics_monthly_snapshots"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."analytics_monthly_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."analytics_monthly_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_monthly_snapshots" TO "service_role";


--
-- Name: TABLE "events"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";


--
-- Name: TABLE "folders"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."folders" TO "anon";
GRANT ALL ON TABLE "public"."folders" TO "authenticated";
GRANT ALL ON TABLE "public"."folders" TO "service_role";


--
-- Name: TABLE "goals"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";


--
-- Name: TABLE "monthly_takes"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."monthly_takes" TO "anon";
GRANT ALL ON TABLE "public"."monthly_takes" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_takes" TO "service_role";


--
-- Name: TABLE "sku_sequences"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."sku_sequences" TO "anon";
GRANT ALL ON TABLE "public"."sku_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."sku_sequences" TO "service_role";


--
-- Name: TABLE "study_deadlines"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."study_deadlines" TO "anon";
GRANT ALL ON TABLE "public"."study_deadlines" TO "authenticated";
GRANT ALL ON TABLE "public"."study_deadlines" TO "service_role";


--
-- Name: TABLE "study_materials"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."study_materials" TO "anon";
GRANT ALL ON TABLE "public"."study_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."study_materials" TO "service_role";


--
-- Name: TABLE "study_modules"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."study_modules" TO "anon";
GRANT ALL ON TABLE "public"."study_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."study_modules" TO "service_role";


--
-- Name: TABLE "study_sessions"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."study_sessions" TO "anon";
GRANT ALL ON TABLE "public"."study_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."study_sessions" TO "service_role";


--
-- Name: TABLE "study_topics"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."study_topics" TO "anon";
GRANT ALL ON TABLE "public"."study_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."study_topics" TO "service_role";


--
-- Name: TABLE "study_tracks"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."study_tracks" TO "anon";
GRANT ALL ON TABLE "public"."study_tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."study_tracks" TO "service_role";


--
-- Name: TABLE "tags"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";


--
-- Name: TABLE "tasks"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";


--
-- Name: TABLE "work_sessions"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."work_sessions" TO "anon";
GRANT ALL ON TABLE "public"."work_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."work_sessions" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--


