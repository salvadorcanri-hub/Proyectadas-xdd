-- Optional demonstration classroom. No accounts, passwords or grades are created.
-- Run after 001_edupuntos.sql only if you want sample students and assignments.
begin;
insert into public.edu_students(id,code,name,avatar) values('est-1','EST-01','Camila Mendoza','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-2','EST-02','Mateo Quispe','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-3','EST-03','Lucía Fernández','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-4','EST-04','Joaquín Salazar','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-5','EST-05','Valeria Rojas','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-6','EST-06','Diego Huamán','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-7','EST-07','Sofía Morales','') on conflict do nothing;
insert into public.edu_students(id,code,name,avatar) values('est-8','EST-08','Sebastián Paredes','') on conflict do nothing;
insert into public.edu_assignments(id,title,subject,description,due_date) values('asg-1','Fracciones y Porcentajes','Matemáticas','Resolver los ejercicios del 1 al 10 de la página 45 del libro. Tomar foto nítida de todo el procedimiento en el cuaderno.','2026-10-12') on conflict do nothing;
insert into public.edu_assignments(id,title,subject,description,due_date) values('asg-2','Ensayo: El Medio Ambiente','Comunicación','Redactar un texto argumentativo de 2 páginas sobre la conservación del agua con introducción, argumentos y conclusión.','2026-10-15') on conflict do nothing;
insert into public.edu_assignments(id,title,subject,description,due_date) values('asg-3','Informe de Laboratorio: Fotosíntesis','Ciencia y Tecnología','Dibujar el esquema del cloroplasto y anotar las conclusiones del experimento con las hojas de espinaca.','2026-10-18') on conflict do nothing;
commit;
