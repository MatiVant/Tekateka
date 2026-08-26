-- Script para establecer mtrovant@gmail.com como superadmin

-- Actualizar el perfil del usuario para que sea superadmin
UPDATE profiles 
SET role = 'superadmin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'mtrovant@gmail.com');

-- Verificar que se actualizó correctamente
SELECT p.id, au.email, p.role 
FROM profiles p
JOIN auth.users au ON p.id = au.id
WHERE au.email = 'mtrovant@gmail.com';
