-- Fix database function security issues by setting proper search_path
-- This addresses the "Function Search Path Mutable" warnings

-- Update existing functions to have stable search_path
CREATE OR REPLACE FUNCTION public.simple_tsv(p_content text, p_title text DEFAULT NULL::text, p_article text DEFAULT NULL::text)
 RETURNS tsvector
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path = public
AS $function$
  select to_tsvector(
           'simple',
           unaccent(
             coalesce(p_title,'') || ' ' ||
             coalesce(p_article,'') || ' ' ||
             coalesce(p_content,'')
           )
         )
$function$;

CREATE OR REPLACE FUNCTION public.compute_stable_key(p jsonb, p_article text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path = public
AS $function$
  select case
           when public.compute_law_key(p) is not null
             then public.compute_law_key(p) || '::' || coalesce(p_article,'')
           else null
         end
$function$;

CREATE OR REPLACE FUNCTION public.compute_law_key(p jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path = public
AS $function$
  select case
    when nullif(coalesce(p->>'doc_no', p->>'doc_number'), '') is not null
     and nullif(p->>'doc_year','') is not null
    then (coalesce(p->>'jurisdiction','QA')) || ':' ||
         (coalesce(p->>'doc_type','other')) || '/' ||
         (coalesce(p->>'doc_no', p->>'doc_number')) || '-' || (p->>'doc_year')
    else null end
$function$;

CREATE OR REPLACE FUNCTION public.ilike_unaccent(a text, b text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path = public
AS $function$
  select unaccent(coalesce(a,'')) ilike unaccent(coalesce(b,''))
$function$;

CREATE OR REPLACE FUNCTION public.extract_article_num(p text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path = public
AS $function$
  select nullif(regexp_replace(translate(coalesce(p,''),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9]','','g'),'')::int
$function$;