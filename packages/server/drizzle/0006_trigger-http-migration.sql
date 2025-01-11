-- Custom SQL migration file, put your code below! --

UPDATE triggers
SET context = jsonb_set(
    jsonb_set(
        jsonb_set(
            context,
            '{hostname}', 
            CASE 
                WHEN context->'hostname' IS NOT NULL AND jsonb_typeof(context->'hostname') = 'array'
                THEN (context->'hostname'->0)::jsonb
                ELSE 'null'::jsonb
            END,
            true
        ),
        '{method}',
        CASE 
            WHEN context->'method' IS NOT NULL AND jsonb_typeof(context->'method') = 'array'
            THEN (context->'method'->0)::jsonb
            ELSE 'null'::jsonb
        END,
        true
    ),
    '{path}',
    CASE 
        WHEN context->'path' IS NOT NULL AND jsonb_typeof(context->'path') = 'array'
        THEN (context->'path'->0)::jsonb
        ELSE 'null'::jsonb
    END,
    true
)
WHERE (context->'hostname' IS NOT NULL AND jsonb_typeof(context->'hostname') = 'array')
   OR (context->'method' IS NOT NULL AND jsonb_typeof(context->'method') = 'array')
   OR (context->'path' IS NOT NULL AND jsonb_typeof(context->'path') = 'array');
