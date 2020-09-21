CREATE EXTENSION
IF NOT EXISTS pgcrypto;
BEGIN;
    DROP VIEW IF EXISTS "RunView";
    DROP VIEW IF EXISTS "AggregatedLumisection";
DROP AGGREGATE IF EXISTS oms_attributes
    (jsonb);
DROP AGGREGATE IF EXISTS rr_attributes
(jsonb);
DROP AGGREGATE IF EXISTS mergejsonb
(jsonb);
DROP AGGREGATE IF EXISTS mergejsonbarray
(jsonb);


CREATE OR REPLACE FUNCTION
    mergejsonb
(jsonb, jsonb) RETURNS jsonb
AS 'SELECT $1 || $2;'
LANGUAGE SQL                                   
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE AGGREGATE mergejsonb(jsonb)
(sfunc =
mergejsonb, stype = jsonb, initcond = '{}');


CREATE AGGREGATE oms_attributes(jsonb)
(sfunc =
mergejsonb, stype = jsonb, initcond = '{}');

CREATE AGGREGATE rr_attributes(jsonb)
(sfunc =
mergejsonb, stype = jsonb, initcond = '{}');


CREATE OR REPLACE FUNCTION
    mergejsonbarray
(jsonb, jsonb) RETURNS jsonb
AS 'SELECT array_to_json(array(select distinct jsonb_array_elements( $1 || $2)))::jsonb;'
LANGUAGE SQL                                   
    IMMUTABLE
    RETURNS NULL ON NULL INPUT;

CREATE AGGREGATE mergejsonbarray(jsonb)
(sfunc =
mergejsonbarray, stype = jsonb, initcond = '[]');


CREATE OR REPLACE VIEW "RunView" as
SELECT "RunEvent"."run_number",
    oms_attributes("RunEvent"."oms_metadata"
ORDER BY "RunEvent"."version"
), 
rr_attributes
("RunEvent"."rr_metadata" 
ORDER BY "RunEvent"."version")
FROM "RunEvent" INNER JOIN "Event" ON "Event"."version" = "RunEvent"."version"
GROUP BY "RunEvent"."run_number";


-- CREATE OR REPLACE VIEW "LumisectionEventJSONB" as
-- select *
-- from
--     (SELECT *
--     from "LumisectionEventAssignation"
--         inner join (
-- SELECT "Event"."comment", "Event"."by" , "LumisectionEvent"."version" as "version2", "run_number", "name", "jsonb"
--         from "LumisectionEvent" inner join "JSONBDeduplication" ON "LumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "LumisectionEvent"."version" = "Event"."version"
--         ORDER BY "LumisectionEvent"."version" DESC) as "Merged" on "LumisectionEventAssignation"."version" = "Merged"."version2") as "rr"


--     inner join

--     (SELECT "run_number" as "oms_run_number", "name" as "oms_name", "lumisection_number" as "oms_lumisection_number", "jsonb" as "oms_jsonb"
--     from "OMSLumisectionEventAssignation"
--         inner join(
-- SELECT "Event"."comment", "Event"."by" , "OMSLumisectionEvent"."version" as "version3", "run_number", "name", "jsonb"
--         from "OMSLumisectionEvent" inner join "JSONBDeduplication" ON "OMSLumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id" inner join "Event" on "OMSLumisectionEvent"."version" = "Event"."version"
--         ORDER BY "OMSLumisectionEvent"."version" DESC) as "OMSMerged" on "OMSLumisectionEventAssignation"."version" = "OMSMerged"."version3") as "oms"


--     on "oms"."oms_run_number" = "rr"."run_number" and "oms"."oms_name" = "rr"."name" and "rr"."lumisection_number" = "oms"."oms_lumisection_number";


CREATE OR REPLACE VIEW "AggregatedLumisection" as
SELECT
    lumisection.run_number,
    lumisection.name,
    lumisection.lumisection_number,
    lumisection.oms_lumisection,
    lumisection.rr_lumisection,
    run.run_rr_attributes,
    run.run_oms_attributes,
    dataset.dataset_attributes
FROM (
	SELECT oms_lumisection_changes.run_number,
        mergejsonb(oms_jsonb
    ORDER BY oms_version ASC) AS oms_lumisection,
    oms_lumisection_changes.lumisection_number,
    oms_lumisection_changes.name,
    mergejsonb(rr_jsonb
ORDER BY manual_change ASC, rr_version ASC
) AS rr_lumisection FROM
    (

    --	OMS LUMISECTION (Starts with changes that went in the run which belongs in the online dataset, and then performs UNION with the changes of the specific dataset
    -- The union is to make sure we are including the online OMS lumisection values, and then joining them with whichever changes occur in offline on that dataset. We first go for the name
        SELECT online.run_number, offline.name, jsonb AS oms_jsonb, online.lumisection_number, online.version AS oms_version
    FROM (
			SELECT run_number, name AS online_name, lumisection_number, jsonb, "OMSLumisectionEventAssignation".version
        FROM "OMSLumisectionEventAssignation"
            INNER JOIN "OMSLumisectionEvent" on "OMSLumisectionEventAssignation".version = "OMSLumisectionEvent".version
            INNER JOIN "JSONBDeduplication" ON "OMSLumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id"
        WHERE "OMSLumisectionEvent".name = 'online'
        ORDER BY "OMSLumisectionEvent".version ASC
			) online
        inner join
        (SELECT DISTINCT run_number, name, lumisection_number
        FROM "OMSLumisectionEventAssignation"
            INNER JOIN "OMSLumisectionEvent" ON "OMSLumisectionEventAssignation".version = "OMSLumisectionEvent".version
        WHERE "OMSLumisectionEvent".name <> 'online') offline
        ON online.run_number = offline.run_number
            AND online.lumisection_number = offline.lumisection_number



UNION


    SELECT run_number, name, jsonb AS oms_jsonb, lumisection_number , version AS oms_version
    FROM (
		SELECT run_number, name, lumisection_number, jsonb, "OMSLumisectionEventAssignation".version
        FROM "OMSLumisectionEventAssignation"
            INNER JOIN "OMSLumisectionEvent" ON "OMSLumisectionEventAssignation".version = "OMSLumisectionEvent".version
            INNER JOIN "JSONBDeduplication" ON "OMSLumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id"
	) oms_dataset_changes
	
	                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
	)
oms_lumisection_changes
	
	INNER JOIN

--	RR LUMISECTION:
(SELECT run_number, name, lumisection_number, manual_change,  jsonb AS rr_jsonb, rr_version
FROM (
		SELECT run_number, name, lumisection_number, jsonb, manual_change, "LumisectionEventAssignation".version AS rr_version
    FROM "LumisectionEventAssignation"
        INNER JOIN "LumisectionEvent" ON "LumisectionEventAssignation".version = "LumisectionEvent".version
        INNER JOIN "JSONBDeduplication" ON "LumisectionEvent"."lumisection_metadata_id" = "JSONBDeduplication"."id"
		) rr_dataset_changes
	)

rr_lumisection_changes
	
	ON oms_lumisection_changes.run_number = rr_lumisection_changes.run_number 
	   AND oms_lumisection_changes.name = rr_lumisection_changes.name 
	   AND oms_lumisection_changes.lumisection_number = rr_lumisection_changes.lumisection_number
	   
	GROUP BY oms_lumisection_changes.run_number, oms_lumisection_changes.lumisection_number, oms_lumisection_changes.name
)lumisection


-- DATASET INFORMATION:
INNER JOIN
(SELECT run_number AS dataset_run_number,
    name AS dataset_name,
    dataset_attributes
FROM "Dataset"
		)
dataset 
		ON dataset.dataset_run_number = lumisection.run_number 
		AND dataset.dataset_name = lumisection.name


-- RUN INFORMATION:
INNER JOIN
(SELECT run_number AS run_run_number,
    rr_attributes AS run_rr_attributes,
    oms_attributes AS run_oms_attributes
FROM "Run")
run ON lumisection.run_number = run.run_run_number

;

COMMIT;