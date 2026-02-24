from django.db import migrations
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_add_roles'),
    ]

    operations = [
        migrations.AlterField(
            model_name='role',
            name='name',
            field=django.db.models.fields.CharField(
                choices=[
                    ('admin', 'Администратор'),
                    ('senior', 'Старший специалист'),
                    ('sysadmin', 'Системный администратор'),
                    ('communications', 'Связист'),
                ],
                max_length=50,
                unique=True,
            ),
        ),
    ]
