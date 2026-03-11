from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0025_ofdcompany'),
    ]

    operations = [
        migrations.AlterField(
            model_name='client',
            name='pharmacy_code',
            field=models.CharField(blank=True, max_length=50, verbose_name='Код аптеки (UT)'),
        ),
        migrations.AddField(
            model_name='client',
            name='warehouse_code',
            field=models.CharField(blank=True, max_length=50, verbose_name='Код склада'),
        ),
    ]
