UPDATE public.regions SET sort_order = v.ord FROM (VALUES
 ('11111111-1111-4111-8111-000000000001'::uuid,1),
 ('11111111-1111-4111-8111-000000000002'::uuid,2),
 ('11111111-1111-4111-8111-000000000003'::uuid,3),
 ('11111111-1111-4111-8111-000000000004'::uuid,4),
 ('b57f6fe1-3936-4dc9-a6d6-5318577ea670'::uuid,5),
 ('0fe8ae68-c85a-403c-bc4c-4698df90fbcd'::uuid,6),
 ('cedbdb6c-8248-4fea-96e3-db4fc8ec9214'::uuid,7),
 ('db0f7a63-f8ce-4c24-8447-468e0232e81a'::uuid,8),
 ('1084e78c-2611-4195-933f-5cf151efb38a'::uuid,9),
 ('139dc8ab-3906-4f70-bb46-df41f077cc43'::uuid,10),
 ('b82a6402-deb3-458b-a1c9-7ace770347f1'::uuid,11),
 ('635d65c6-fb41-4b8c-a427-4e35641ca078'::uuid,12),
 ('b700fdd2-9a71-46f7-8402-48031c775663'::uuid,13)
) AS v(id, ord) WHERE public.regions.id = v.id;