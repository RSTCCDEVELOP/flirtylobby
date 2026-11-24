from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sysobjects', '0011_variable_kind'),
    ]

    operations = [
        migrations.AlterField(
            model_name='systemobject',
            name='kind',
            field=models.CharField(choices=[('donation', 'Donatie'), ('plan', 'Abonnement'), ('plugin', 'Plugin'), ('plugin_item', 'Onderdeel van een plugin'), ('plugin_part', 'Pluginblok'), ('media', 'Media'), ('calculator', 'Calculatie'), ('marketing', 'Marketing'), ('pricelist', 'Prijslijst'), ('installation', 'Standaardinstallatie'), ('ai', 'AI-blok'), ('energy', 'Energie'), ('variable', 'Variabele'), ('widget', 'Widget')], max_length=12),
        ),
        migrations.CreateModel(
            name='InstalledWidget',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(max_length=40, unique=True)),
                ('enabled', models.BooleanField(default=True)),
                ('options', models.JSONField(blank=True, default=dict)),
                ('installed_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['key']},
        ),
    ]
